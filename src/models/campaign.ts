import { Dashboard } from "./Dashboard";
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
import { TeamsMetadata, getTeamsForCampaign, filterTeamsByNames } from "./Teams";

export type TargetPopulationData = TargetPopulationData;

export interface Antigen {
    id: string;
    name: string;
    code: string;
    doses: { id: string; name: string }[];
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
    teams: Maybe<number>;
    teamsMetadata: TeamsMetadata;
    dashboardId: Maybe<string>;
}

type ValidationErrors = Array<{
    key: string;
    namespace?: _.Dictionary<string>;
}>;

function getError(key: string, namespace: Maybe<Dictionary<string>> = undefined): ValidationErrors {
    return namespace ? [{ key, namespace }] : [{ key }];
}

interface DataSetWithAttributes {
    id: string;
    name: string;
    attributeValues: AttributeValue[];
}

interface DashboardWithResources {
    id: string;
    name: string;
    dashboardItems: {
        id: string;
        chart: Ref;
        map: Ref;
        reportTable: Ref;
    };
}

export default class Campaign {
    public selectableLevels: number[] = [5];

    validations: _.Dictionary<() => ValidationErrors | Promise<ValidationErrors>> = {
        name: this.validateName,
        startDate: this.validateStartDate,
        endDate: this.validateEndDate,
        teams: this.validateTeams,
        organisationUnits: this.validateOrganisationUnits,
        antigens: this.validateAntigens,
        targetPopulation: this.validateTargetPopulation,
        antigensDisaggregation: this.validateAntigensDisaggregation,
    };

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
            teams: undefined,
            teamsMetadata: {
                elements: [],
            },
            dashboardId: undefined,
        };

        return new Campaign(db, config, initialData);
    }

    public static async get(
        config: MetadataConfig,
        db: DbD2,
        dataSetId: string
    ): Promise<Campaign> {
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
        if (!dataSet) throw new Error(`Dataset id=${dataSetId} not found`);

        const antigensByCode = _.keyBy(config.antigens, "code");
        const antigens = _(dataSet.sections)
            .map(section => antigensByCode[section.name])
            .compact()
            .value();
        const periods = dataSet.dataInputPeriods.map(dip => dip.period.id);
        const [startDate, endDate] = [_.min(periods), _.max(periods)].map(period =>
            period ? moment(period).toDate() : null
        );

        const organisationUnitIds = dataSet.organisationUnits.map(ou => ou.id);

        const teamsCategoyId = _(config.categories)
            .keyBy("code")
            .getOrFail(config.categoryComboCodeForTeams).id;

        const teamsMetadata = await getTeamsForCampaign(
            db,
            organisationUnitIds,
            teamsCategoyId,
            dataSet.name
        );
        const dashboardId: Maybe<string> = _(dataSet.attributeValues)
            .keyBy(attributeValue => attributeValue.attribute.id)
            .get([config.attributes.dashboard.id, "value"]);

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
            teams: _.size(teamsMetadata),
            teamsMetadata: {
                elements: teamsMetadata,
            },
            dashboardId,
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
        const modelReferencesToDelete = await this.getResources(config, db, dataSets);

        return db.deleteMany(modelReferencesToDelete, ["categoryOptions"]);
    }

    public async validate(
        validationKeys: Maybe<string[]> = undefined
    ): Promise<Dictionary<ValidationErrors>> {
        const obj = _(this.validations)
            .pickBy((_value, key) => !validationKeys || _(validationKeys).includes(key))
            .mapValues(fn => (fn ? fn.call(this) : []))
            .value();
        const [keys, promises] = _.unzip(_.toPairs(obj));
        const values = await Promise.all(promises as Promise<ValidationErrors>[]);
        return _.fromPairs(_.zip(keys, values));
    }

    validateStartDate(): ValidationErrors {
        return !this.data.startDate ? getError("cannot_be_blank", { field: "start date" }) : [];
    }

    validateEndDate(): ValidationErrors {
        return !this.data.endDate ? getError("cannot_be_blank", { field: "end date" }) : [];
    }

    validateTeams(): ValidationErrors {
        const { teams } = this.data;
        return _.compact([
            !teams ? getError("cannot_be_blank", { field: "teams" })[0] : null,
            teams && teams <= 0 ? getError("must_be_bigger_than_zero")[0] : null,
        ]);
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

    public async existsCampaignWithSameName(name: string): Promise<boolean> {
        const { id } = this.data;
        const nameLowerCase = name.trim().toLowerCase();

        const { dataSets } = await this.db.getMetadata<{
            dataSets: Array<{ id: string; name: string }>;
        }>({
            dataSets: {
                fields: { id: true, name: true },
                filters: [`name:$ilike:${nameLowerCase}`],
            },
        });

        return dataSets.some(ds => ds.id !== id && ds.name.toLowerCase() === nameLowerCase);
    }

    private async validateName(): Promise<ValidationErrors> {
        const { name } = this.data;
        const trimmedName = name.trim();

        if (!trimmedName) {
            return getError("cannot_be_blank", { field: "name" });
        } else if (await this.existsCampaignWithSameName(trimmedName)) {
            return getError("name_must_be_unique");
        } else {
            return [];
        }
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

    validateAntigens(): ValidationErrors {
        return _(this.data.antigens).isEmpty() ? getError("no_antigens_selected") : [];
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

    validateAntigensDisaggregation(): ValidationErrors {
        return this.data.antigensDisaggregation.validate();
    }

    /* Target population */

    public async saveTargetPopulation(): Promise<Response<string>> {
        const campaignDb = new CampaignDb(this);
        return campaignDb.saveTargetPopulation();
    }

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

    validateTargetPopulation(): ValidationErrors {
        const { targetPopulation } = this.data;
        return !targetPopulation
            ? getError("no_target_population_defined")
            : targetPopulation.validate();
    }

    // Attribute Values

    public get dashboardId(): Maybe<string> {
        return this.data.dashboardId;
    }

    public async getDashboard(): Promise<Maybe<Dashboard>> {
        if (this.dashboardId) {
            const metadata = await this.db.getMetadata<{ dashboards: Dashboard[] }>({
                dashboards: { filters: [`id:eq:${this.dashboardId}`] },
            });
            return _.first(metadata.dashboards);
        } else {
            return undefined;
        }
    }

    public async getDashboardOrCreate(): Promise<Maybe<Dashboard>> {
        const dashboard = await this.getDashboard();

        if (dashboard) {
            return dashboard;
        } else {
            await this.save();
            const savedCampaign = await this.reload();
            return savedCampaign ? savedCampaign.getDashboard() : undefined;
        }
    }

    /* Teams */

    public get teams(): Maybe<number> {
        return this.data.teams;
    }

    public setTeams(teams: number): Campaign {
        return this.update({ ...this.data, teams });
    }

    public get teamsMetadata(): TeamsMetadata {
        return this.data.teamsMetadata;
    }

    /* Save */

    isEdit(): boolean {
        return !!this.id;
    }

    public async save(): Promise<Response<string>> {
        const campaignDb = new CampaignDb(this);
        return campaignDb.save();
    }

    public async reload(): Promise<Maybe<Campaign>> {
        return this.id ? Campaign.get(this.config, this.db, this.id) : undefined;
    }

    public static async getResources(
        config: MetadataConfig,
        db: DbD2,
        dataSets: DataSetWithAttributes[]
    ) {
        if (_.isEmpty(dataSets)) return [];

        const dashboardIds = _(dataSets)
            .flatMap(dataSet => dataSet.attributeValues)
            .filter(attrVal => attrVal.attribute.code === config.attributeCodeForDashboard)
            .map(attributeValue => attributeValue.value)
            .value();

        const { dashboards } = await db.getMetadata<{ dashboards: DashboardWithResources[] }>({
            dashboards: {
                fields: {
                    id: true,
                    name: true,
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

        const campaignNames = dataSets.map(d => d.name);

        const { categoryOptions: teams } = await db.api.get("/categoryOptions", {
            fields: ["id,name,categories[id]"],
            filter: campaignNames.map(cn => `name:like$:${cn}`),
            rootJunction: "OR",
            paging: false,
        });

        const teamsCategoyId = _(config.categories)
            .keyBy("code")
            .getOrFail(config.categoryComboCodeForTeams).id;

        const filteredTeams = filterTeamsByNames(teams, campaignNames, teamsCategoyId);

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

        return _.concat(
            dashboards.map(dashboard => ({ model: "dashboards", id: dashboard.id })),
            dataSets.map(dataSet => ({ model: "dataSets", id: dataSet.id })),
            resources,
            filteredTeams.map((team: Ref) => ({ model: "categoryOptions", id: team.id }))
        );
    }
}
