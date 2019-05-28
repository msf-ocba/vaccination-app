import DbD2, { ApiResponse, ModelReference } from "./db-d2";
import { generateUid } from "d2/uid";
import moment from "moment";
import _ from "lodash";
import "../utils/lodash-mixins";

import Campaign from "./campaign";
import { DataSetCustomForm } from "./DataSetCustomForm";
import { Maybe, MetadataResponse, DataEntryForm, Section, AttributeValue } from "./db.types";
import { Metadata, DataSet, Response } from "./db.types";
import { getDaysRange, toISOStringNoTZ } from "../utils/date";
import { getDataElements } from "./AntigensDisaggregation";
import { Dashboard } from "./Dashboard";
import { Teams, TeamsData } from "./Teams";

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

        if (!campaign.startDate || !campaign.endDate) {
            return { status: false, error: "Campaign Dates not set" };
        }
        const startDate = moment(campaign.startDate).startOf("day");
        const endDate = moment(campaign.endDate).endOf("day");

        const teamGenerator = Teams.build(db, teamsMetadata);
        const newTeams = teamGenerator.getTeams({
            teams: campaign.teams || 0,
            name: campaign.name,
            organisationUnits: campaign.organisationUnits,
            teamsCategoyId,
            startDate,
            endDate,
            isEdit: campaign.isEdit(),
        });

        const teamsToCreate = _.differenceBy(newTeams, teamsMetadata.elements, "id");
        const teamsToDelete = _.differenceBy(teamsMetadata.elements, newTeams, "id");

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

            if (!populationResult.status) {
                return {
                    status: false,
                    error: JSON.stringify(populationResult.error, null, 2),
                };
            } else {
                return this.postSave(
                    {
                        charts,
                        reportTables,
                        dashboards: [dashboard],
                        dataSets: [dataSet],
                        dataEntryForms: [dataEntryForm],
                        sections,
                        categoryOptions: teamsToCreate,
                    },
                    teamsToDelete
                );
            }
        }
    }

    private async postSave(
        allMetadata: PostSaveMetadata,
        teamsToDelete: TeamsData[]
    ): Promise<Response<string>> {
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

        const result: ApiResponse<MetadataResponse> = await db.postMetadata<Metadata>(metadata);

        if (campaign.isEdit()) {
            await this.cleanUpDashboardItems(db, modelReferencesToDelete);

            // Teams must be deleted after all asociated dashboard and dashboard items (favorites) are deleted
            if (!_.isEmpty(teamsToDelete)) {
                await Teams.deleteTeams(db, teamsToDelete);
            }
        }
        // Update Team Category with new categoryOptions (teams)
        Teams.updateTeamCategory(db, allMetadata.categoryOptions, teamsToDelete, config);

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
}
