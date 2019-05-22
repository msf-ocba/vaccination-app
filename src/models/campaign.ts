import { OrganisationUnit, Maybe, Ref, AttributeValue } from "./db.types";
import _, { Dictionary } from "lodash";
import moment from "moment";

import { PaginatedObjects, OrganisationUnitPathOnly, Response } from "./db.types";
import DbD2 from "./db-d2";
import { AntigensDisaggregation, SectionForDisaggregation } from "./AntigensDisaggregation";
import { MetadataConfig } from "./config";
import { AntigenDisaggregationEnabled } from "./AntigensDisaggregation";
import { TargetPopulation, TargetPopulationData } from "./TargetPopulation";
import CampaignDb from "./CampaignDb";

export type TargetPopulationData = TargetPopulationData;

export interface Antigen {
    id: string;
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
    attributeValues: AttributeValue[];
    teams: Maybe<number>;
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

    constructor(public db: DbD2, public config: MetadataConfig, private data: Data) {}

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
            attributeValues: [],
            teams: undefined,
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
                attributeValues: Array<AttributeValue>;
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
                    attributeValues: { value: true, attribute: { id: true, code: true } },
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
            attributeValues: dataSet.attributeValues,
            targetPopulation: undefined,
            teams: undefined,
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
        const modelReferencesToDelete = await this.getResourcesToDelete(config, db, dataSets);

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
            teams,
        } = this.data;

        const validation = {
            name: !name.trim() ? getError("cannot_be_blank", { field: "name" }) : [],

            startDate: !startDate ? getError("cannot_be_blank", { field: "start date" }) : [],

            endDate: !endDate ? getError("cannot_be_blank", { field: "end date" }) : [],

            teams: _.compact([
                !teams ? { key: "cannot_be_blank" } : null,
                teams && teams <= 0 ? { key: "must_be_bigger_than_zero" } : null,
            ]),

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

    public get id(): Maybe<string> {
        return this.data.id;
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

    // Attribute Values

    public get attributeValues(): AttributeValue[] {
        return this.data.attributeValues;
    }

    /* Teams */

    public get teams(): Maybe<number> {
        return this.data.teams;
    }

    public setTeams(teams: string): Campaign {
        return this.update({ ...this.data, teams: parseInt(teams) });
    }

    /* Save */

    isEdit(): boolean {
        return !!this.id;
    }

    public async save(): Promise<Response<string>> {
        const campaignDb = new CampaignDb(this);
        return campaignDb.save();
    }

    public static async getResourcesToDelete(
        config: MetadataConfig,
        db: DbD2,
        dataSets: DataSetWithAttributes[]
    ) {
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
            dataSets.map(dataSet => ({ model: "dataSets", id: dataSet.id })),
            resources
        );
        return modelReferencesToDelete;
    }
}
