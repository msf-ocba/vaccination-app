import _ from "lodash";
import DbD2, { ApiResponse } from "./db-d2";
import { generateUid } from "d2/uid";
import { Moment } from "moment";
import { OrganisationUnitPathOnly, Response, MetadataResponse, Ref } from "./db.types";
import { MetadataConfig } from "./config";

export interface TeamsData {
    id: string;
    [key: string]: string | Array<object> | Moment;
}

export interface TeamsMetadata {
    elements: TeamsData[];
}

export class Teams {
    constructor(private metadata: TeamsMetadata) {}

    static build(metadata: TeamsMetadata) {
        return new Teams(metadata);
    }

    public getTeams(args: {
        teams: number;
        name: string;
        organisationUnits: OrganisationUnitPathOnly[];
        teamsCategoyId: string;
        startDate: Moment;
        endDate: Moment;
        isEdit: boolean;
    }): TeamsData[] {
        const { teams, name, organisationUnits, teamsCategoyId, startDate, endDate, isEdit } = args;
        const {
            metadata: { elements: oldTeams },
        } = this;
        if (!teams) return [];

        if (!isEdit) {
            return this.generateTeams(
                teams,
                name,
                organisationUnits,
                teamsCategoyId,
                startDate,
                endDate
            );
        }

        const teamDifference = teams - _.size(oldTeams);

        //Update periodDates and OU references for previous teams
        const allTeams = oldTeams.map(ot => ({
            ...ot,
            startDate,
            endDate,
            organisationUnits,
        }));

        if (teamDifference > 0) {
            return [
                ...allTeams,
                ...this.generateTeams(
                    teamDifference,
                    name,
                    organisationUnits,
                    teamsCategoyId,
                    startDate,
                    endDate,
                    _.size(oldTeams)
                ),
            ];
        } else if (teamDifference < 0) {
            return _(allTeams)
                .sortBy("name")
                .take(teams)
                .value();
        } else {
            return allTeams;
        }
    }

    private generateTeams(
        teams: number,
        campaignName: string,
        organisationUnits: OrganisationUnitPathOnly[],
        categoryIdForTeams: string,
        startDate: Moment,
        endDate: Moment,
        nameOffset: number = 0
    ): TeamsData[] {
        const teamsData: TeamsData[] = _.range(1, teams + 1).map(i => {
            const name = `Team ${nameOffset + i} ${campaignName}`;
            const categoryOption = {
                id: generateUid(),
                name,
                shortName: name,
                displayName: name,
                publicAccess: "rw------",
                displayShortName: name,
                startDate,
                endDate,
                dimensionItemType: "CATEGORY_OPTION",
                categories: [
                    {
                        id: categoryIdForTeams,
                    },
                ],
                organisationUnits: organisationUnits.map(ou => ({
                    id: ou.id,
                })),
            };
            return categoryOption;
        });

        return teamsData;
    }

    static async updateTeamCategory(
        db: DbD2,
        newTeams: Array<object>,
        teamsToDelete: Ref[],
        config: MetadataConfig
    ): Promise<Response<string>> {
        const categoryIdForTeams = _(config.categories)
            .keyBy("code")
            .getOrFail(config.categoryComboCodeForTeams).id;

        const { categories } = await db.api.get("/metadata", {
            "categories:fields": ":owner",
            "categories:filter": `id:eq:${categoryIdForTeams}`,
        });

        const previousTeams = categories[0].categoryOptions;
        const teamsToDeleteIds = _.map(teamsToDelete, "id");
        const filteredPreviousTeams = previousTeams.filter(
            (pt: { id: string }) => !_.includes(teamsToDeleteIds, pt.id)
        );

        const previousTeamsIds = _.map(previousTeams, "id");
        const filteredNewTeams = _.map(newTeams, (t: { id: string }) => {
            return _.includes(previousTeamsIds, t.id) ? null : { id: t.id };
        });

        const allTeams = [...filteredPreviousTeams, ..._.compact(filteredNewTeams)];

        const teamsCategoryUpdated = { ...categories[0], categoryOptions: allTeams };

        const teamsResponse: ApiResponse<MetadataResponse> = await db.postMetadata({
            categories: [teamsCategoryUpdated],
        });

        if (!teamsResponse.status) {
            return { status: false, error: "Cannot update teams category" };
        } else {
            db.api.post("/maintenance/categoryOptionComboUpdate", {});
            return { status: true };
        }
    }

    // Teams must be deleted after all asociated dashboard and dashboard items (favorites) are deleted
    static async deleteTeams(db: DbD2, teams: TeamsData[]) {
        const toDelete = teams.map(t => ({ model: "categoryOptions", id: t.id }));
        return await db.deleteMany(toDelete);
    }
}

export async function getTeamsForCampaign(
    db: DbD2,
    organisationUnitIds: string[],
    teamCategoryId: string,
    campaignName: string
): Promise<TeamsData[]> {
    const { categoryOptions } = await db.api.get("/metadata", {
        "categoryOptions:fields": ":owner,categories[id],name",
        "categoryOptions:filter": `organisationUnits.id:in:[${organisationUnitIds}]`,
    });

    if (_.isEmpty(categoryOptions)) return [];
    const expression = `^Team \\d ${campaignName}$`;
    const matcher = new RegExp(expression);

    const teams = categoryOptions.filter(
        (co: { categories: Array<{ id: string }>; name: string }) => {
            const categoryIds = co.categories.map(c => c.id);
            return _.includes(categoryIds, teamCategoryId) && matcher.test(co.name);
        }
    );

    return teams;
}
