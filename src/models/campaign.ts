import { OrganisationUnit, Maybe, Section } from "./db.types";
///<reference path="../types/d2.d.ts" />
import { DataSetCustomForm } from "./DataSetCustomForm";
import _, { Dictionary } from "lodash";
import moment from "moment";

import { AntigensDisaggregation, SectionForDisaggregation } from "./AntigensDisaggregation";
import { MetadataResponse, DataEntryForm } from "./db.types";
import { generateUid } from "d2/uid";
import { DataSet, Response } from "./db.types";
import { PaginatedObjects, OrganisationUnitPathOnly } from "./db.types";
import DbD2 from "./db-d2";
import { getDaysRange, toISOStringNoTZ } from "../utils/date";
import { MetadataConfig } from "./config";
import { AntigenDisaggregationEnabled, getDataElements } from "./AntigensDisaggregation";
import { TargetPopulation, TargetPopulationData } from "./TargetPopulation";

export type TargetPopulationData = TargetPopulationData;

export interface Antigen {
    name: string;
    code: string;
}

export interface Data {
    id: Maybe<string>;
    name: string;
    description: string;
    organisationUnits: OrganisationUnitPathOnly[];
    startDate: Date | null;
    endDate: Date | null;
    antigens: Antigen[];
    antigensDisaggregation: AntigensDisaggregation;
    targetPopulation: Maybe<TargetPopulation>;
}

function getError(key: string, namespace: Maybe<Dictionary<string>> = undefined) {
    return namespace ? [{ key, namespace }] : [{ key }];
}

export default class Campaign {
    public selectableLevels: number[] = [5];

    constructor(private db: DbD2, public config: MetadataConfig, private data: Data) {}

    public static create(config: MetadataConfig, db: DbD2): Campaign {
        const antigens: Antigen[] = [];
        const organisationUnits: OrganisationUnit[] = [];

        const initialData = {
            id: undefined,
            name: "",
            description: "",
            organisationUnits: organisationUnits,
            startDate: null,
            endDate: null,
            antigens: antigens,
            antigensDisaggregation: AntigensDisaggregation.build(config, antigens, []),
            targetPopulation: undefined,
        };

        return new Campaign(db, config, initialData);
    }

    public static async get(
        config: MetadataConfig,
        db: DbD2,
        dataSetId: string
    ): Promise<Maybe<Campaign>> {
        const {
            dataSets: [dataSet],
        } = await db.getMetadata<{
            dataSets: Array<{
                id: string;
                name: string;
                description: string;
                organisationUnits: Array<OrganisationUnitPathOnly>;
                dataInputPeriods: Array<{ period: { id: string } }>;
                sections: Array<SectionForDisaggregation>;
            }>;
        }>({
            dataSets: {
                fields: {
                    id: true,
                    name: true,
                    description: true,
                    organisationUnits: { id: true, path: true },
                    dataInputPeriods: { period: { id: true } },
                    sections: {
                        id: true,
                        name: true,
                        dataSet: { id: true },
                        dataElements: { id: true },
                        sortOrder: true,
                        greyedFields: {
                            categoryOptionCombo: {
                                id: true,
                                categoryOptions: {
                                    id: true,
                                    name: true,
                                    categories: { id: true },
                                },
                            },
                            dataElement: { id: true },
                        },
                    },
                },
                filters: [`id:eq:${dataSetId}`],
            },
        });
        if (!dataSet) return;

        const antigensByCode = _.keyBy(config.antigens, "code");
        const antigens = _(dataSet.sections)
            .map(section => antigensByCode[section.name])
            .compact()
            .value();
        const periods = dataSet.dataInputPeriods.map(dip => dip.period.id);
        const [startDate, endDate] = [_.min(periods), _.max(periods)].map(period =>
            period ? moment(period).toDate() : null
        );

        const initialData = {
            id: dataSet.id,
            name: dataSet.name,
            description: dataSet.description,
            organisationUnits: dataSet.organisationUnits,
            startDate,
            endDate,
            antigens: antigens,
            antigensDisaggregation: AntigensDisaggregation.build(
                config,
                antigens,
                dataSet.sections
            ),
            targetPopulation: undefined,
        };

        return new Campaign(db, config, initialData);
    }

    public update(newData: Data) {
        return new Campaign(this.db, this.config, newData);
    }

    public validate() {
        const {
            name,
            startDate,
            endDate,
            antigens,
            targetPopulation,
            antigensDisaggregation,
        } = this.data;

        const validation = {
            name: !name.trim() ? getError("cannot_be_blank", { field: "name" }) : [],

            startDate: !startDate ? getError("cannot_be_blank", { field: "start date" }) : [],

            endDate: !endDate ? getError("cannot_be_blank", { field: "end date" }) : [],

            organisationUnits: this.validateOrganisationUnits(),

            antigens: _(antigens).isEmpty() ? getError("no_antigens_selected") : [],

            targetPopulation: !targetPopulation
                ? getError("no_target_population_defined")
                : targetPopulation.validate(),

            antigensDisaggregation: antigensDisaggregation.validate(),
        };

        return validation;
    }

    /* Organisation units */

    private validateOrganisationUnits() {
        const { organisationUnits } = this.data;

        const allOrgUnitsInAcceptedLevels = _(organisationUnits).every(ou =>
            _(this.selectableLevels).includes(
                _(ou.path)
                    .countBy()
                    .get("/") || 0
            )
        );
        const levels = this.selectableLevels.join("/");

        const errorsList = [
            !allOrgUnitsInAcceptedLevels
                ? getError("organisation_units_only_of_levels", { levels })
                : [],
            _(organisationUnits).isEmpty() ? getError("no_organisation_units_selected") : [],
        ];

        return _(errorsList)
            .flatten()
            .compact()
            .value();
    }

    public async getOrganisationUnitsWithName(): Promise<PaginatedObjects<OrganisationUnit>> {
        const ids = this.data.organisationUnits.map(ou => ou.id);
        return this.db.getOrganisationUnitsFromIds(ids, { pageSize: 100 });
    }

    public setOrganisationUnits(organisationUnits: OrganisationUnitPathOnly[]): Campaign {
        // Use orgUnits only with id/path, that's the only info we get from a orgunit-tree
        return this.update({ ...this.data, organisationUnits });
    }

    public get organisationUnits(): OrganisationUnitPathOnly[] {
        return this.data.organisationUnits;
    }

    /* Name */

    public setName(name: string): Campaign {
        return this.update({ ...this.data, name });
    }

    public get name(): string {
        return this.data.name;
    }

    /* Description */

    public setDescription(description: string): Campaign {
        return this.update({ ...this.data, description });
    }

    public get description(): string {
        return this.data.description;
    }

    /* Period dates */

    public setStartDate(startDate: Date | null): Campaign {
        return this.update({ ...this.data, startDate });
    }

    public get startDate(): Date | null {
        return this.data.startDate;
    }

    public setEndDate(endDate: Date | null): Campaign {
        return this.update({ ...this.data, endDate });
    }

    public get endDate(): Date | null {
        return this.data.endDate;
    }

    /* Antigens */

    public setAntigens(antigens: Antigen[]): Campaign {
        const { antigensDisaggregation } = this.data;
        return this.update({
            ...this.data,
            antigens,
            antigensDisaggregation: antigensDisaggregation.setAntigens(antigens),
        });
    }

    public get antigens(): Antigen[] {
        return this.data.antigens;
    }

    public get antigenCodes(): string[] {
        return this.antigens.map(antigen => antigen.code);
    }

    public getAvailableAntigens(): Antigen[] {
        return this.config.antigens;
    }

    /* Antigens disaggregation */

    public get antigensDisaggregation(): AntigensDisaggregation {
        return this.data.antigensDisaggregation;
    }

    public setAntigensDisaggregation(antigensDisaggregation: AntigensDisaggregation): Campaign {
        return this.update({ ...this.data, antigensDisaggregation });
    }

    public getEnabledAntigensDisaggregation(): AntigenDisaggregationEnabled {
        return this.antigensDisaggregation.getEnabled();
    }

    /* Target population */

    public get targetPopulation(): Maybe<TargetPopulation> {
        return this.data.targetPopulation;
    }

    public setTargetPopulation(targetPopulation: TargetPopulation): Campaign {
        return this.update({ ...this.data, targetPopulation });
    }

    public async withTargetPopulation(): Promise<Campaign> {
        const targetPopulation =
            this.data.targetPopulation || TargetPopulation.build(this.config, this.db);

        const targetPopulationForCampaign = await targetPopulation.update(
            this.organisationUnits,
            this.getEnabledAntigensDisaggregation(),
            this.startDate ? moment(this.startDate).format("YYYYMMDD") : "TODAY"
        );

        return this.update({
            ...this.data,
            targetPopulation: targetPopulationForCampaign,
        });
    }

    /* Save */

    public async save(): Promise<Response<string>> {
        const dataSetId = this.data.id || generateUid();
        const metadataConfig = this.config;
        const { categoryComboCodeForTeams, categoryCodeForTeams } = metadataConfig;
        const { app: attributeForApp, dashboard: dashboardAttribute } = metadataConfig.attributes;
        const categoryCombosByCode = _.keyBy(metadataConfig.categoryCombos, "code");
        const categoryComboTeams = _(categoryCombosByCode).get(categoryComboCodeForTeams);

        if (!this.startDate || !this.endDate) {
            return { status: false, error: "Campaign Dates not set" };
        }
        const startDate = moment(this.startDate).startOf("day");
        const endDate = moment(this.endDate).endOf("day");
        const { dashboard, charts, reportTables } = await this.db.createDashboard(
            this.name,
            this.organisationUnits,
            this.antigens,
            startDate,
            endDate,
            categoryCodeForTeams
        );

        const { targetPopulation } = this.data;

        if (!attributeForApp || !dashboardAttribute) {
            return { status: false, error: "Metadata not found: Attributes" };
        } else if (!categoryComboTeams) {
            return {
                status: false,
                error: `Metadata not found: categoryCombo.code=${categoryComboCodeForTeams}`,
            };
        } else if (!dashboard) {
            return { status: false, error: "Error creating dashboard" };
        } else if (!targetPopulation) {
            return { status: false, error: "There is no target population in campaign" };
        } else {
            const disaggregationData = this.getEnabledAntigensDisaggregation();
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

            const disMetadata = await this.antigensDisaggregation.getCustomFormMetadata(
                this.config.categoryCombos
            );

            const { dataSets: existingDataSets } = this.data.id
                ? await this.db.getMetadata<{
                      dataSets: Array<{
                          sections: Array<{ id: string; name: string; dataSet: { id: string } }>;
                          dataEntryForm: { id: string };
                      }>;
                  }>({
                      dataSets: {
                          filters: [`id:eq:${this.data.id}`],
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

            const existingDataSet = _.first(existingDataSets);
            const customForm = await DataSetCustomForm.build(this);
            const customFormHtml = customForm.generate();
            const formId =
                (existingDataSet &&
                    existingDataSet.dataEntryForm &&
                    existingDataSet.dataEntryForm.id) ||
                generateUid();
            const dataEntryForm: DataEntryForm = {
                id: formId,
                name: this.name + " " + formId, // dataEntryForm.name must be unique
                htmlCode: customFormHtml,
                style: "NONE",
            };

            const existingSections = existingDataSet ? existingDataSet.sections : [];
            const existingSectionsByName = _.keyBy(existingSections, "name");

            const sectionsUsed: Section[] = disaggregationData.map((disaggregationData, index) => {
                const sectionName = disaggregationData.antigen.code;
                // !NAME -> Old unused section
                const existingSection =
                    existingSectionsByName[sectionName] ||
                    existingSectionsByName["!" + sectionName];

                return {
                    id: existingSection ? existingSection.id : generateUid(),
                    dataSet: { id: dataSetId },
                    sortOrder: index,
                    name: sectionName,
                    dataElements: disaggregationData.dataElements.map(de => ({ id: de.id })),
                    // Use grey fields with an inverted logic: set the selected dataElement.cocId.
                    greyedFields: _(disaggregationData.dataElements)
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
                        .value(),
                };
            });

            const existingSectionsUnused = _(existingSections)
                .differenceBy(sectionsUsed, "id")
                .map(section =>
                    section.name.startsWith("!")
                        ? section
                        : { ...section, name: "!" + section.name }
                )
                .value();

            const sections = _(sectionsUsed)
                .concat(existingSectionsUnused)
                .value();

            const dataSet: DataSet = {
                id: dataSetId,
                name: this.name,
                description: this.description,
                publicAccess: "r-r-----", // Metadata can view-only, Data can view-only
                periodType: "Daily",
                categoryCombo: { id: categoryComboTeams.id },
                dataElementDecoration: true,
                renderAsTabs: true,
                organisationUnits: this.organisationUnits.map(ou => ({ id: ou.id })),
                dataSetElements,
                openFuturePeriods: 1,
                timelyDays: 0,
                expiryDays: 0,
                formType: "CUSTOM",
                dataInputPeriods,
                attributeValues: [
                    { value: "true", attribute: { id: attributeForApp.id } },
                    { value: dashboard.id, attribute: { id: dashboardAttribute.id } },
                ],
                dataEntryForm: { id: dataEntryForm.id },
                sections: sections.map(section => ({ id: section.id })),
            };

            const period = moment(this.startDate || new Date()).format("YYYYMMDD");
            const dataValues = targetPopulation.getDataValues(period);
            const populationResult = await this.db.postDataValues(dataValues);

            if (!populationResult.status) {
                return {
                    status: false,
                    error: JSON.stringify(populationResult.error, null, 2),
                };
            } else {
                // The saving of existing sections on DHIS2 is buggy, the /metadata endpoint
                // often responds with a 500 Server Error when a data set and their sections are
                // posted on the same request. Posting sections on a separate requests do work.
                const isEdit = !!this.data.id;

                if (isEdit) {
                    const resultSections: MetadataResponse = await this.db.postMetadata({
                        sections: sections,
                    });

                    if (resultSections.status !== "OK") {
                        return {
                            status: false,
                            error: JSON.stringify(resultSections.typeReports, null, 2),
                        };
                    }
                }

                const result: MetadataResponse = await this.db.postMetadata({
                    charts,
                    reportTables,
                    dashboards: [dashboard],
                    dataSets: [dataSet],
                    dataEntryForms: [dataEntryForm],
                    sections: isEdit ? [] : sections,
                });

                if (result.status !== "OK") {
                    return { status: false, error: JSON.stringify(result.typeReports, null, 2) };
                } else {
                    return { status: true };
                }
            }
        }
    }
}
