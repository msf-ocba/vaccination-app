import DbD2, { ApiResponse, ModelReference } from "./db-d2";
import { generateUid } from "d2/uid";
import moment from "moment";
import _ from "lodash";
import "../utils/lodash-mixins";

import Campaign from "./campaign";
import { DataSetCustomForm } from "./DataSetCustomForm";
import {
    Maybe,
    MetadataResponse,
    DataEntryForm,
    Section,
    AttributeValue,
    OrganisationUnitPathOnly,
    Ref,
} from "./db.types";
import { Metadata, DataSet, Response } from "./db.types";
import { getDaysRange, toISOStringNoTZ } from "../utils/date";
import { getDataElements } from "./AntigensDisaggregation";
import { Dashboard } from "./Dashboard";

interface DataSetWithSections {
    sections: Array<{ id: string; name: string; dataSet: { id: string } }>;
    dataEntryForm: { id: string };
}

interface PostSaveMetadata {
    charts: object[];
    reportTables: object[];
    dashboards: object[];
    dataSets: DataSet[];
    dataEntryForms: DataEntryForm[];
    sections: Section[];
    categoryOptions: object[];
}

export default class CampaignDb {
    constructor(public campaign: Campaign) {}

    public async editedTeams() {
        const { campaign } = this;
        const {
            teams,
            teamsMetadata: { organisationUnitIds: oldOrganisationUnitIds, elements: oldTeams },
            organisationUnits,
            config,
        } = campaign;
        if (!teams) return;

        const newOrganisationUnitIds = organisationUnits.map(ou => ou.id);
        const teamsCategoyId = _(config.categories)
            .keyBy("code")
            .getOrFail(config.categoryComboCodeForTeams).id;

        const teamDifference = teams - _.size(oldTeams);

        const organisationUnitsDifferenceIds = _.difference(
            newOrganisationUnitIds,
            oldOrganisationUnitIds
        );

        // happy case
        if (!teamDifference && _.isEmpty(organisationUnitsDifferenceIds)) return;

        let newTeams = [...oldTeams];

        // New teams
        if (teamDifference > 0) {
            newTeams = [
                ...newTeams,
                ...this.generateTeams(
                    teamDifference,
                    campaign.name,
                    campaign.organisationUnits,
                    teamsCategoyId,
                    _.size(oldTeams)
                ),
            ];
        } else if (teamDifference < 0) {
            newTeams = _(oldTeams)
                .sortBy("name")
                .slice(0, _.size(oldTeams) + 1 + teamDifference)
                .value();

            // Remove OU references for deleted teams
            const removedTeams: Array<object> = _.differenceBy(oldTeams, newTeams, "id");
            if (!_.isEmpty(removedTeams)) await this.cleanRemovedTeams(removedTeams);
        }

        // Clean teams for unselected OUs
        const removeOf = _.intersection(oldOrganisationUnitIds, organisationUnitsDifferenceIds);
        if (!_.isEmpty(removeOf)) await this.updateTeamsByOrganisationUnitIds(removeOf);
        console.log({ newTeams, teamDifference, organisationUnitsDifferenceIds, oldTeams, teams });
        // TODO:
        // - Return extra teams for creation - DONE
        // - Update Team Category with new teams (only? or is it the same if we post the whole lot again?)
        // - Include extra (minus) teams on dashboard regeneration

        return newTeams;
        //const addTo = _.intersection(newOrganisationUnitIds, organisationUnitsDifference);
    }

    // Removes ou references for deleted teams
    private async cleanRemovedTeams(toRemove: Array<object>) {
        const { db } = this.campaign;
        const updatedTeams = _.map(toRemove, co => ({ ...co, organisationUnits: [] }));
        const updateResponse = await db.postMetadata({ categoryOptions: updatedTeams });
        if (!updateResponse.status) {
            return { status: false, error: "Cannot remove old teams from Organisation Units" };
        }
    }

    public async save(): Promise<Response<string>> {
        const { campaign } = this;
        const { db, targetPopulation, config: metadataConfig, teamsMetadata } = campaign;
        const dataSetId = campaign.id || generateUid();
        const { categoryComboCodeForTeams } = metadataConfig;
        const { app: attributeForApp, dashboard: dashboardAttribute } = metadataConfig.attributes;
        const categoryComboIdForTeams = _(metadataConfig.categoryCombos)
            .keyBy("code")
            .getOrFail(categoryComboCodeForTeams).id;
        const teamsCategoyId = _(metadataConfig.categories)
            .keyBy("code")
            .getOrFail(categoryComboCodeForTeams).id;

        //// TEAMS SECTION

        const newTeams = campaign.isEdit()
            ? await this.editedTeams()
            : this.generateTeams(
                  campaign.teams || 0, // WIP
                  campaign.name,
                  campaign.organisationUnits,
                  teamsCategoyId
              );

        const teamsToCreate = _.differenceBy(newTeams, teamsMetadata.elements, "id");

        /*
        if (campaign.isEdit()) {
            teamsData = this.editedTeams();
        } else {
            teamsData = this.generateTeams(
                campaign.teams || 0, // WIP
                campaign.name,
                campaign.organisationUnits,
                teamsCategoyId
            );
        }
        */
        if (!campaign.startDate || !campaign.endDate) {
            return { status: false, error: "Campaign Dates not set" };
        }
        const startDate = moment(campaign.startDate).startOf("day");
        const endDate = moment(campaign.endDate).endOf("day");
        const dashboardId: Maybe<string> = campaign.isEdit()
            ? _(campaign.attributeValues)
                  .keyBy((o: AttributeValue) => o.attribute.id)
                  .getOrFail(dashboardAttribute.id).value
            : undefined;

        const antigensDisaggregation = campaign.getEnabledAntigensDisaggregation();
        const ageGroupCategoryId = _(metadataConfig.categories)
            .keyBy("code")
            .getOrFail(metadataConfig.categoryCodeForAgeGroup).id;
        const teamIds: string[] = _.map(newTeams, "id");
        const dashboardGenerator = Dashboard.build(db);
        const { dashboard, charts, reportTables } = await dashboardGenerator.create({
            dashboardId,
            datasetName: campaign.name,
            organisationUnits: campaign.organisationUnits,
            antigens: campaign.antigens,
            startDate,
            endDate,
            antigensDisaggregation,
            categoryOptions: metadataConfig.categoryOptions,
            ageGroupCategoryId,
            teamsCategoyId,
            teamIds,
        });

        if (!attributeForApp || !dashboardAttribute) {
            return { status: false, error: "Metadata not found: attributes" };
        } else if (!categoryComboIdForTeams) {
            return {
                status: false,
                error: `Metadata not found: categoryCombo.code=${categoryComboCodeForTeams}`,
            };
        } else if (!dashboard) {
            return { status: false, error: "Error creating dashboard" };
        } else if (!targetPopulation) {
            return { status: false, error: "There is no target population in campaign" };
        } else {
            const disaggregationData = campaign.getEnabledAntigensDisaggregation();
            const dataElements = getDataElements(metadataConfig, disaggregationData);

            const dataSetElements = dataElements.map(dataElement => ({
                dataSet: { id: dataSetId },
                dataElement: { id: dataElement.id },
                categoryCombo: { id: dataElement.categoryCombo.id },
            }));

            const dataInputPeriods = getDaysRange(startDate, endDate).map(date => ({
                openingDate: toISOStringNoTZ(startDate),
                closingDate: toISOStringNoTZ(endDate),
                period: { id: date.format("YYYYMMDD") },
            }));

            const existingDataSet = await this.getExistingDataSet();
            const dataEntryForm = await this.getDataEntryForm(existingDataSet);
            const sections = await this.getSections(dataSetId, existingDataSet);

            const dataSet: DataSet = {
                id: dataSetId,
                name: campaign.name,
                description: campaign.description,
                publicAccess: "r-r-----", // Metadata can view-only, Data can view-only
                periodType: "Daily",
                categoryCombo: { id: categoryComboIdForTeams },
                dataElementDecoration: true,
                renderAsTabs: true,
                organisationUnits: campaign.organisationUnits.map(ou => ({ id: ou.id })),
                dataSetElements,
                openFuturePeriods: 1,
                timelyDays: 0,
                expiryDays: 0,
                formType: "CUSTOM",
                dataInputPeriods,
                attributeValues: [
                    { value: "true", attribute: { id: attributeForApp.id } },
                    {
                        value: dashboard.id,
                        attribute: { id: dashboardAttribute.id, code: dashboardAttribute.code },
                    },
                ],
                dataEntryForm: { id: dataEntryForm.id },
                sections: sections.map(section => ({ id: section.id })),
            };

            const period = moment(campaign.startDate || new Date()).format("YYYYMMDD");
            const dataValues = targetPopulation.getDataValues(period);
            const populationResult = await db.postDataValues(dataValues);

            console.log({ teamsToCreate: teamsToCreate });

            if (!populationResult.status) {
                return {
                    status: false,
                    error: JSON.stringify(populationResult.error, null, 2),
                };
            } else {
                return this.postSave({
                    charts,
                    reportTables,
                    dashboards: [dashboard],
                    dataSets: [dataSet],
                    dataEntryForms: [dataEntryForm],
                    sections,
                    categoryOptions: teamsToCreate,
                });
            }
        }
    }

    private async postSave(allMetadata: PostSaveMetadata): Promise<Response<string>> {
        const { campaign } = this;
        const { db, config } = campaign;
        const { sections, ...nonSectionsMetadata } = allMetadata;
        let metadata;
        let modelReferencesToDelete: ModelReference[] = [];

        if (campaign.isEdit()) {
            // The saving of existing sections on DHIS2 is buggy: /metadata
            // often responds with a 500 Server Error when a data set and their sections are
            // posted on the same request. Workaround: post the sections on a separate request.

            const resultSections: ApiResponse<MetadataResponse> = await db.postMetadata({
                sections: sections,
            });

            if (!resultSections.status) {
                return { status: false, error: "Cannot update sections" };
            }
            metadata = nonSectionsMetadata;
            modelReferencesToDelete = await Campaign.getResourcesToDelete(
                config,
                db,
                allMetadata.dataSets
            );
        } else {
            metadata = allMetadata;
        }

        // Clean Organisation Unit of past teams beforehand to avoid having them appear on DataEntry app.
        const organisationUnitIds = this.campaign.organisationUnits.map(ou => ou.id);

        if (!campaign.isEdit()) {
            await this.updateTeamsByOrganisationUnitIds(organisationUnitIds, true);
        }

        const result: ApiResponse<MetadataResponse> = await db.postMetadata<Metadata>(metadata);

        // Update Team Category with new categoryOptions (teams)
        await this.updateTeamCategory(allMetadata.categoryOptions);

        if (campaign.isEdit()) {
            await this.cleanUpDashboardItems(db, modelReferencesToDelete);
        }

        if (!result.status) {
            return { status: false, error: result.error };
        } else if (result.value.status !== "OK") {
            return {
                status: false,
                error: JSON.stringify(result.value.typeReports, null, 2),
            };
        } else {
            return { status: true };
        }
    }

    private async cleanUpDashboardItems(
        db: DbD2,
        modelReferencesToDelete: ModelReference[]
    ): Promise<Response<string>> {
        const dashboardItems = _(modelReferencesToDelete)
            .filter(o => _.includes(["charts", "reportTables"], o.model))
            .value();

        return await db.deleteMany(dashboardItems);
    }

    private async getSections(
        dataSetId: string,
        existingDataSet: Maybe<DataSetWithSections>
    ): Promise<Section[]> {
        const { campaign } = this;
        const existingSections = existingDataSet ? existingDataSet.sections : [];
        const existingSectionsByName = _.keyBy(existingSections, "name");
        const disaggregationData = campaign.getEnabledAntigensDisaggregation();

        const disMetadata = await campaign.antigensDisaggregation.getCustomFormMetadata(
            campaign.config.categoryCombos
        );

        const sectionsUsed: Section[] = disaggregationData.map((disaggregationData, index) => {
            const sectionName = disaggregationData.antigen.code;
            // !NAME -> Old unused section
            const existingSection =
                existingSectionsByName[sectionName] || existingSectionsByName["!" + sectionName];

            const greyedFields = _(disaggregationData.dataElements)
                .flatMap(dataElementDis => {
                    const { antigen } = disaggregationData;
                    const groups: string[][] = _.cartesianProduct(
                        dataElementDis.categories.map(category => category.categoryOptions)
                    );

                    return groups.map(group => {
                        const cocName = [antigen.name, ...group].join(", ");
                        const disCode = antigen.code + "-" + dataElementDis.code;
                        const { cocIdByName } = _(disMetadata).getOrFail(disCode);
                        const cocId = _(cocIdByName).getOrFail(cocName);

                        return {
                            dataElement: { id: dataElementDis.id },
                            categoryOptionCombo: { id: cocId },
                        };
                    });
                })
                .value();

            return {
                id: existingSection ? existingSection.id : generateUid(),
                dataSet: { id: dataSetId },
                sortOrder: index,
                name: sectionName,
                dataElements: disaggregationData.dataElements.map(de => ({ id: de.id })),
                // Use grey fields with inverted logic: set the used dataElement.cocId.
                greyedFields,
            };
        });

        const existingSectionsUnused = _(existingSections)
            .differenceBy(sectionsUsed, "id")
            .map(section =>
                section.name.startsWith("!") ? section : { ...section, name: "!" + section.name }
            )
            .value();

        return _.concat(sectionsUsed, existingSectionsUnused);
    }

    private async getExistingDataSet(): Promise<Maybe<DataSetWithSections>> {
        const { campaign } = this;
        const { dataSets: existingDataSets } = campaign.id
            ? await campaign.db.getMetadata<{
                  dataSets: Array<DataSetWithSections>;
              }>({
                  dataSets: {
                      filters: [`id:eq:${campaign.id}`],
                      fields: {
                          dataEntryForm: { id: true },
                          sections: {
                              id: true,
                              name: true,
                              dataSet: { id: true },
                          },
                      },
                  },
              })
            : { dataSets: [] };

        return _.first(existingDataSets);
    }

    private async getDataEntryForm(
        existingDataSet: Maybe<DataSetWithSections>
    ): Promise<DataEntryForm> {
        const { campaign } = this;
        const customForm = await DataSetCustomForm.build(campaign);
        const customFormHtml = customForm.generate();
        const formId =
            (existingDataSet &&
                existingDataSet.dataEntryForm &&
                existingDataSet.dataEntryForm.id) ||
            generateUid();

        return {
            id: formId,
            name: campaign.name + " " + formId, // dataEntryForm.name must be unique
            htmlCode: customFormHtml,
            style: "NONE",
        };
    }

    // WIP until edit logic is added //
    private async updateTeamCategory(teamsData: Array<object>) {
        const { config, db } = this.campaign;
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

    // Clean OU references for specific OUs
    private async updateTeamsByOrganisationUnitIds(
        organisationUnitIds: string[],
        cleanAll = false
    ) {
        const { db, config } = this.campaign;

        const teams: Array<{
            organisationUnits: Array<Ref>;
        }> = await db.getTeamsForOrganisationUnits(
            organisationUnitIds,
            config.categoryCodeForTeams
        );

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
        nameOffset: number = 0
    ) {
        const teamsData: Array<object> = _.range(1, teams + 1).map(i => {
            const name = `${campaignName} ${nameOffset + i}`;
            const categoryOption = {
                id: generateUid(),
                name,
                shortName: name,
                displayName: name,
                publicAccess: "rw------",
                displayShortName: name,
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
}
