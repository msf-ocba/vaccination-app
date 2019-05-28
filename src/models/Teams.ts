import _ from "lodash";
import DbD2, { ApiResponse } from "./db-d2";
import { generateUid } from "d2/uid";
import { Moment } from "moment";
import { OrganisationUnitPathOnly, MetadataResponse, Ref } from "./db.types";
import { MetadataConfig } from "./config";

export interface TeamsData {
    id: string;
    [key: string]: string | Array<object> | Moment;
}

export interface TeamsMetadata {
    elements: TeamsData[];
    organisationUnitIds: Array<string>;
}

export class Teams {
    constructor(private db: DbD2, private metadata: TeamsMetadata) {}

    static build(db: DbD2, metadata: TeamsMetadata) {
        return new Teams(db, metadata);
    }

    public getTeams({
        teams,
        name,
        organisationUnits,
        teamsCategoyId,
        startDate,
        endDate,
        isEdit,
    }: {
        teams: number;
        name: string;
        organisationUnits: OrganisationUnitPathOnly[];
        teamsCategoyId: string;
        startDate: Moment;
        endDate: Moment;
        isEdit: boolean;
    }) {
        const {
            metadata: { organisationUnitIds: oldOrganisationUnitIds, elements: oldTeams },
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

        const newOrganisationUnitIds = organisationUnits.map(ou => ou.id);

        const teamDifference = teams - _.size(oldTeams);

        const organisationUnitsDifference =
            !(_.size(newOrganisationUnitIds) === _.size(oldOrganisationUnitIds)) ||
            _.differenceWith(newOrganisationUnitIds, oldOrganisationUnitIds, _.isEqual);

        if (!teamDifference && !organisationUnitsDifference) return [];

        let allTeams = [...oldTeams];

        if (teamDifference > 0) {
            allTeams = [
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
            allTeams = _(oldTeams)
                .sortBy("name")
                .slice(0, _.size(oldTeams) + teamDifference)
                .value();
        }

        if (organisationUnitsDifference) {
            this.updateTeamsOUs(organisationUnits);
        }
        return allTeams;
    }

    private async updateTeamsOUs(organisationUnits: OrganisationUnitPathOnly[]) {
        const {
            db,
            metadata: { elements: oldTeams },
        } = this;

        const updatedTeams = _.map(oldTeams, co => ({
            ...co,
            organisationUnits,
        }));

        const updateResponse = await db.postMetadata({ categoryOptions: updatedTeams });

        if (!updateResponse.status) {
            return { status: false, error: "Cannot clean old Organisation Units from teams" };
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
    ) {
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
        }

        // Trigger categoryOptionCombos update
        await db.api.post(
            "http://dev2.eyeseetea.com:8082/api/maintenance/categoryOptionComboUpdate",
            {}
        );
    }

    // Teams must be deleted after all asociated dashboard and dashboard items (favorites) are deleted
    static async deleteTeams(db: DbD2, teams: TeamsData[]) {
        const toDelete = teams.map(t => ({ model: "categoryOptions", id: t.id }));
        return await db.deleteMany(toDelete);
    }
}
