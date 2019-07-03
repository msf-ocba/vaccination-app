import _, { Dictionary } from "lodash";
import DbD2 from "./db-d2";
import { generateUid } from "d2/uid";
import {
    dashboardItemsConfig,
    itemsMetadataConstructor,
    buildDashboardItems,
} from "./dashboard-items";
import {
    Ref,
    OrganisationUnitPathOnly,
    CategoryOption,
    OrganisationUnitWithName,
} from "./db.types";
import { Antigen } from "./campaign";
import { Moment } from "moment";
import { getDaysRange } from "../utils/date";
import { AntigenDisaggregationEnabled } from "./AntigensDisaggregation";

type DashboardItem = {
    type: string;
};

export interface ChartItem extends DashboardItem {
    chart: Ref;
}

export interface ReportTableItem extends DashboardItem {
    reportTable: Ref;
}

type DashboardData = {
    id: string;
    name: string;
    code: string;
    dashboardItems: Array<ReportTableItem | ChartItem>;
};

type allDashboardElements = {
    charts: Array<object>;
    reportTables: Array<object>;
    items: Array<ChartItem | ReportTableItem>;
};

export type DashboardMetadata = {
    dashboards: DashboardData[];
    charts: object[];
    reportTables: object[];
};

export class Dashboard {
    constructor(private db: DbD2) {}

    static build(db: DbD2) {
        return new Dashboard(db);
    }

    private async getMetadataForDashboardItems(
        antigens: Antigen[],
        organisationUnitsPathOnly: OrganisationUnitPathOnly[],
        antigensDisaggregation: AntigenDisaggregationEnabled,
        categoryOptions: CategoryOption[],
        ageGroupCategoryId: string,
        teamsCategoryId: string,
        teamIds: string[],
        dosesCategoryId: string
    ) {
        const orgUnitsId = _(organisationUnitsPathOnly).map("id");
        const dashboardItems = [dashboardItemsConfig.charts, dashboardItemsConfig.tables];
        const elements = _(dashboardItems)
            .values()
            .flatMap(_.values)
            .groupBy("dataType")
            .mapValues(objs => _.flatMap(objs, "elements"))
            .value();

        const allDataElementCodes = elements["DATA_ELEMENT"].join(",");
        const allIndicatorCodes = elements["INDICATOR"].join(",");
        const antigenCodes = antigens.map(an => an.code);
        const { antigenCategoryCode } = dashboardItemsConfig;

        const {
            categories,
            dataElements,
            indicators,
            organisationUnits: organisationUnitsWithName,
        } = await this.db.api.get<{
            categories?: {
                id: string;
                code: string;
                categoryOptions: { id: string; code: string; name: string }[];
            }[];
            dataElements?: { id: string; code: string }[];
            indicators?: { id: string; code: string }[];
            categoryOptions?: {
                id: string;
                categories: { id: string; code: string }[];
                organisationUnits: { id: string };
            }[];
            organisationUnits?: { id: string; displayName: string; path: string }[];
        }>("/metadata", {
            "categories:fields": "id,code,categoryOptions[id,code,name]",
            "categories:filter": `code:in:[${antigenCategoryCode}]`,
            "dataElements:fields": "id,code",
            "dataElements:filter": `code:in:[${allDataElementCodes}]`,
            "indicators:fields": "id,code",
            "indicators:filter": `code:in:[${allIndicatorCodes}]`,
            "organisationUnits:fields": "id,displayName,path",
            "organisationUnits:filter": `id:in:[${orgUnitsId}]`,
        });

        const categoriesByCode = _(categories).keyBy(category => category.code);
        const antigenCategory = categoriesByCode.getOrFail(antigenCategoryCode);

        const antigensMeta = _.filter(antigenCategory.categoryOptions, op =>
            _.includes(antigenCodes, op.code)
        );

        const categoryOptionsByName: _.Dictionary<string> = _(categoryOptions)
            .map(co => [co.displayName, co.id])
            .fromPairs()
            .value();

        const ageGroupsToId = (ageGroups: string[]): string[] =>
            _.map(ageGroups, ag => categoryOptionsByName[ag]);

        const ageGroupsByAntigen: _.Dictionary<string[]> = _(antigensDisaggregation)
            .map(d => [d.antigen.id, ageGroupsToId(d.ageGroups)])
            .fromPairs()
            .value();

        const dosesByAntigen = _(antigensDisaggregation)
            .map(d => [d.antigen.id, d.antigen.doses])
            .fromPairs()
            .value();

        const dashboardMetadata = {
            antigenCategory: antigenCategory.id,
            dataElements: {
                type: "DATA_ELEMENT",
                data: dataElements,
                key: "dataElement",
            },
            indicators: {
                type: "INDICATOR",
                data: indicators,
                key: "indicator",
            },
            antigensMeta,
            organisationUnitsWithName,
            disaggregationMetadata: {
                teams: () => ({
                    categoryId: teamsCategoryId,
                    elements: teamIds,
                }),
                ageGroups: (antigen: Ref) => ({
                    categoryId: ageGroupCategoryId,
                    elements: ageGroupsByAntigen[antigen.id],
                }),
                doses: (antigen: Ref) => ({
                    categoryId: dosesCategoryId,
                    elements: dosesByAntigen[antigen.id],
                }),
            },
        };

        return dashboardMetadata;
    }

    public async create({
        dashboardId,
        datasetName,
        organisationUnits,
        antigens,
        startDate,
        endDate,
        antigensDisaggregation,
        categoryOptions,
        ageGroupCategoryId,
        teamsCategoyId,
        teamIds,
        dosesCategoryId,
        dashboardCode,
    }: {
        dashboardId?: string;
        datasetName: string;
        organisationUnits: OrganisationUnitPathOnly[];
        antigens: Antigen[];
        startDate: Moment;
        endDate: Moment;
        antigensDisaggregation: AntigenDisaggregationEnabled;
        categoryOptions: CategoryOption[];
        ageGroupCategoryId: string;
        teamsCategoyId: string;
        teamIds: string[];
        dosesCategoryId: string;
        dashboardCode: string;
    }): Promise<DashboardMetadata> {
        const dashboardItemsMetadata = await this.getMetadataForDashboardItems(
            antigens,
            organisationUnits,
            antigensDisaggregation,
            categoryOptions,
            ageGroupCategoryId,
            teamsCategoyId,
            teamIds,
            dosesCategoryId
        );
        const dashboardItems = this.createDashboardItems(
            datasetName,
            startDate,
            endDate,
            dashboardItemsMetadata
        );

        const keys: Array<keyof allDashboardElements> = ["items", "charts", "reportTables"];
        const { items, charts, reportTables } = _(keys)
            .map(key => [key, _(dashboardItems).getOrFail(key)])
            .fromPairs()
            .value();

        const dashboard = {
            id: dashboardId || generateUid(),
            name: `${datasetName}_DASHBOARD`,
            code: dashboardCode,
            dashboardItems: items,
        };

        return { dashboards: [dashboard], charts, reportTables };
    }

    createDashboardItems(
        datasetName: String,
        startDate: Moment,
        endDate: Moment,
        dashboardItemsMetadata: Dictionary<any>
    ): allDashboardElements {
        const { organisationUnitsWithName } = dashboardItemsMetadata;
        const organisationUnitsMetadata = organisationUnitsWithName.map(
            (ou: OrganisationUnitWithName) => ({
                id: ou.id,
                parents: { [ou.id]: ou.path },
                name: ou.displayName,
            })
        );
        const periodRange = getDaysRange(startDate, endDate);
        const period = periodRange.map(date => ({ id: date.format("YYYYMMDD") }));
        const antigensMeta = _(dashboardItemsMetadata).getOrFail("antigensMeta");
        const dashboardItemsElements = itemsMetadataConstructor(dashboardItemsMetadata);

        const { antigenCategoryCode, ...itemsConfig } = dashboardItemsConfig;
        const expectedCharts = _.flatMap(itemsConfig, _.keys);

        const keys = ["antigenCategory", "disaggregationMetadata", ...expectedCharts] as Array<
            keyof typeof dashboardItemsElements
        >;
        const { antigenCategory, disaggregationMetadata, ...elements } = _(keys)
            .map(key => [key, _(dashboardItemsElements).getOrFail(key)])
            .fromPairs()
            .value();

        const dashboardItems = buildDashboardItems(
            antigensMeta,
            datasetName,
            organisationUnitsMetadata,
            period,
            antigenCategory,
            disaggregationMetadata,
            elements
        );
        const charts = _(dashboardItems).getOrFail("charts");
        const reportTables = _(dashboardItems).getOrFail("reportTables");

        const chartIds = charts.map(chart => chart.id);
        const reportTableIds = reportTables.map(table => table.id);

        const dashboardCharts = chartIds.map((id: string) => ({
            type: "CHART",
            chart: { id },
        }));
        const dashboardTables = reportTableIds.map((id: string) => ({
            type: "REPORT_TABLE",
            reportTable: { id },
        }));

        const dashboardData = {
            items: [...dashboardCharts, ...dashboardTables],
            charts,
            reportTables,
        };

        return dashboardData;
    }
}
