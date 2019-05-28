import _ from "lodash";
import DbD2, { ApiResponse } from "./db-d2";
import { generateUid } from "d2/uid";
import { Moment } from "moment";
import { Ref, OrganisationUnitPathOnly, MetadataResponse } from "./db.types";
import { MetadataConfig } from "./config";

interface TeamsMetadata {
    elements: Array<object>;
    organisationUnitIds: Array<string>;
}

export class Teams {
    constructor(private db: DbD2, private metadata: TeamsMetadata) {}

    static build(db: DbD2, metadata: TeamsMetadata) {
        return new Teams(db, metadata);
    }

    public async getTeams({
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
        if (!teams) return;

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

        const organisationUnitsDifferenceIds = _.difference(
            newOrganisationUnitIds,
            oldOrganisationUnitIds
        );

        // happy case
        if (!teamDifference && _.isEmpty(organisationUnitsDifferenceIds)) return [];

        let newTeams = [...oldTeams];

        // New teams
        if (teamDifference > 0) {
            newTeams = [
                ...newTeams,
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
            newTeams = _(oldTeams)
                .sortBy("name")
                .slice(0, _.size(oldTeams) + 1 + teamDifference)
                .value();

            // TODO: Delete removed teams, must be done on postSave.
        }

        // TODO: Clean teams of unselected OUs or add to all teams new OUs

        console.log({ newTeams, teamDifference, organisationUnitsDifferenceIds, oldTeams, teams });

        return newTeams;
    }

    public async updateTeamsByOrganisationUnitIds(
        organisationUnitIds: string[],
        categoryCodeForTeams: string,
        cleanAll = false
    ) {
        const { db } = this;

        const teams: Array<{
            organisationUnits: Array<Ref>;
        }> = await db.getTeamsForCampaign(organisationUnitIds, categoryCodeForTeams, "removeThis");

        const filteredOrganisationUnits = (team: { organisationUnits: Array<Ref> }) => {
            return _.filter(team.organisationUnits, ou => !_.includes(organisationUnitIds, ou.id));
        };

        const updatedTeams = _.map(teams, co => ({
            ...co,
            organisationUnits: cleanAll ? [] : filteredOrganisationUnits(co),
        }));

        const updateResponse = await db.postMetadata({ categoryOptions: updatedTeams });

        if (!updateResponse.status) {
            return { status: false, error: "Cannot clean old teams from Organisation Units" };
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
    ) {
        const teamsData: Array<object> = _.range(1, teams + 1).map(i => {
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

    static async updateTeamCategory(db: DbD2, teamsData: Array<object>, config: MetadataConfig) {
        const categoryIdForTeams = _(config.categories)
            .keyBy("code")
            .getOrFail(config.categoryComboCodeForTeams).id;

        const { categories } = await db.api.get("/metadata", {
            "categories:fields": ":owner",
            "categories:filter": `id:eq:${categoryIdForTeams}`,
        });

        const previousTeams = categories[0].categoryOptions;
        const previousTeamsIds = _.map(previousTeams, "id");
        const filteredNewTeams = _.map(teamsData, (t: { id: string }) => {
            return _.includes(previousTeamsIds, t.id) ? null : { id: t.id };
        });

        const allTeams = [...previousTeams, ..._.compact(filteredNewTeams)];

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
}
