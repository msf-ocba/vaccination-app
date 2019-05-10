import { OrganisationUnit, Maybe, Ref, Metadata, AttributeValue } from "./db.types";
import { DataSetCustomForm } from "./DataSetCustomForm";
import _, { Dictionary } from "lodash";
import moment from "moment";

import { AntigensDisaggregation } from "./AntigensDisaggregation";
import { MetadataResponse, DataEntryForm } from "./db.types";
import { generateUid } from "d2/uid";
import { DataSet, Response } from "./db.types";
import { PaginatedObjects, OrganisationUnitPathOnly } from "./db.types";
import DbD2, { ApiResponse } from "./db-d2";
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

interface DataSetWithAttributes {
    id: string;
    attributeValues: AttributeValue[];
}

interface DashboardWithResources {
    id: string;
    dashboardItems: {
        id: string;
        chart: Ref;
        map: Ref;
        reportTable: Ref;
    };
}

export default class Campaign {
    public selectableLevels: number[] = [5];

    constructor(private db: DbD2, public config: MetadataConfig, private data: Data) {}

    public static create(config: MetadataConfig, db: DbD2): Campaign {
        const antigens: Antigen[] = [];
        const organisationUnits: OrganisationUnit[] = [];

        const initialData = {
            name: "",
            description: "",
            organisationUnits: organisationUnits,
            startDate: null,
            endDate: null,
            antigens: antigens,
            antigensDisaggregation: AntigensDisaggregation.build(config, antigens),
            targetPopulation: undefined,
        };

        return new Campaign(db, config, initialData);
    }

    public update(newData: Data) {
        return new Campaign(this.db, this.config, newData);
    }

    static async delete(
        config: MetadataConfig,
        db: DbD2,
        dataSets: DataSetWithAttributes[]
    ): Promise<Response<string>> {
        const dashboardIds = _(dataSets)
            .flatMap(dataSet => dataSet.attributeValues)
            .filter(attrVal => attrVal.attribute.code === config.attributeCodeForDashboard)
            .map(attributeValue => attributeValue.value)
            .value();

        const { dashboards } = await db.getMetadata<{ dashboards: DashboardWithResources[] }>({
            dashboards: {
                fields: {
                    id: true,
                    dashboardItems: {
                        id: true,
                        chart: { id: true },
                        map: { id: true },
                        reportTable: { id: true },
                    },
                },
                filters: [`id:in:[${dashboardIds.join(",")}]`],
            },
        });

        const resources: { model: string; id: string }[] = _(dashboards)
            .flatMap(dashboard => dashboard.dashboardItems)
            .flatMap(item => [
                { model: "charts", ref: item.chart },
                { model: "reportTables", ref: item.reportTable },
                { model: "maps", ref: item.map },
            ])
            .map(({ model, ref }) => (ref ? { model, id: ref.id } : null))
            .compact()
            .value();

        const modelReferencesToDelete = _.concat(
            dashboards.map(dashboard => ({ model: "dashboards", id: dashboard.id })),
            resources,
            dataSets.map(dataSet => ({ model: "dataSets", id: dataSet.id }))
        );

        return db.deleteMany(modelReferencesToDelete);
    }

    public async validate() {
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

            organisationUnits: await this.validateOrganisationUnits(),

            antigens: _(antigens).isEmpty() ? getError("no_antigens_selected") : [],

            targetPopulation: !targetPopulation
                ? getError("no_target_population_defined")
                : targetPopulation.validate(),

            antigensDisaggregation: antigensDisaggregation.validate(),
        };

        return validation;
    }

    /* Organisation units */

    private async validateOrganisationUnits() {
        const { organisationUnits } = this.data;

        const allOrgUnitsInAcceptedLevels = _(organisationUnits).every(ou =>
            _(this.selectableLevels).includes(
                _(ou.path)
                    .countBy()
                    .get("/") || 0
            )
        );
        const levels = this.selectableLevels.join("/");

        const orgUnitsWithTeamsInfo = await this.db.validateTeamsForOrganisationUnits(
            organisationUnits,
            this.config.categoryCodeForTeams
        );

        const orgUnitsWithoutTeams = _(orgUnitsWithTeamsInfo)
            .filter(ou => !ou.hasTeams)
            .map(ou => ou.displayName)
            .value();

        const errorsList = [
            !allOrgUnitsInAcceptedLevels
                ? getError("organisation_units_only_of_levels", { levels })
                : [],
            _(organisationUnits).isEmpty() ? getError("no_organisation_units_selected") : [],
            !_.isEmpty(orgUnitsWithoutTeams)
                ? getError("no_valid_teams_for_organisation_units", {
                      orgUnits: orgUnitsWithoutTeams.join(", "),
                  })
                : [],
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
        const dataSetId = generateUid();
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

            const customForm = await DataSetCustomForm.build(this);
            const customFormHtml = customForm.generate();
            const formId = generateUid();
            const dataEntryForm: DataEntryForm = {
                id: formId,
                name: this.name + " " + formId, // dataEntryForm.name must be unique
                htmlCode: customFormHtml,
                style: "NONE",
            };

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
                const result: ApiResponse<MetadataResponse> = await this.db.postMetadata<Metadata>({
                    charts,
                    reportTables,
                    dashboards: [dashboard],
                    dataSets: [dataSet],
                    dataEntryForms: [dataEntryForm],
                });

                if (!result.status) {
                    return { status: false, error: result.error };
                } else if (result.value.status !== "OK") {
                    return {
                        status: false,
                        error: JSON.stringify(result.value.typeReports, null, 2),
                    };
                } else {
                    await this.db.postForm(dataSetId, dataEntryForm);
                    return { status: true };
                }
            }
        }
    }
}
