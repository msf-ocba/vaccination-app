import _, { Dictionary } from "lodash";
import DbD2 from "./db-d2";
import { generateUid } from "d2/uid";
import {
    dashboardItemsConfig,
    itemsMetadataConstructor,
    buildDashboardItems,
} from "./dashboard-items";
import { Ref, OrganisationUnitPathOnly, OrganisationUnit } from "./db.types";
import { Antigen } from "./campaign";
import { Moment } from "moment";
import { getDaysRange } from "../utils/date";

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
    dashboardItems: Array<ReportTableItem | ChartItem>;
};

type allDashboardElements = {
    charts: Array<object>;
    reportTables: Array<object>;
    items: Array<ChartItem | ReportTableItem>;
};

export class Dashboard {
    constructor(private db: DbD2) {}

    static build(db: DbD2) {
        return new Dashboard(db);
    }

    private async getMetadataForDashboardItems(
        antigens: Antigen[],
        organisationUnitsPathOnly: OrganisationUnitPathOnly[],
        categoryCodeForTeams: string
    ) {
        const allAncestorsIds = _(organisationUnitsPathOnly)
            .map("path")
            .flatMap(path => path.split("/").slice(1))
            .uniq()
            .value()
            .join(",");

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
        const {
            categories,
            dataElements,
            indicators,
            categoryOptions,
            organisationUnits: organisationUnitsWithName,
        } = await this.db.api.get("/metadata", {
            "categories:fields": "id,categoryOptions[id,code,name]",
            "categories:filter": `code:in:[${dashboardItemsConfig.antigenCategoryCode}]`,
            "dataElements:fields": "id,code",
            "dataElements:filter": `code:in:[${allDataElementCodes}]`,
            "indicators:fields": "id,code",
            "indicators:filter": `code:in:[${allIndicatorCodes}]`,
            "categoryOptions:fields": "id,categories[id,code],organisationUnits[id]",
            "categoryOptions:filter": `organisationUnits.id:in:[${allAncestorsIds}]`,
            "organisationUnits:fields": "id,displayName,path",
            "organisationUnits:filter": `id:in:[${orgUnitsId}]`,
        });

        const { id: antigenCategory } = categories[0];
        const antigensMeta = _.filter(categories[0].categoryOptions, op =>
            _.includes(antigenCodes, op.code)
        );

        if (!categoryOptions || !categoryOptions[0].categories) {
            throw new Error("Organization Units chosen have no teams associated");
        }

        const teamsByOrgUnit = organisationUnitsPathOnly.reduce((acc, ou) => {
            let teams: string[] = [];
            categoryOptions.forEach(
                (co: { id: string; organisationUnits: object[]; categories: object[] }) => {
                    const coIsTeam = _(co.categories)
                        .map("code")
                        .includes(categoryCodeForTeams);
                    const coIncludesOrgUnit = _(co.organisationUnits)
                        .map("id")
                        .some((coOu: string) => ou.path.includes(coOu));

                    if (coIsTeam && coIncludesOrgUnit) {
                        teams.push(co.id);
                    }
                }
            );
            return { ...acc, [ou.id]: teams };
        }, {});

        const teamsMetadata: Dictionary<any> = {
            ...teamsByOrgUnit,
            categoryId: categoryOptions[0].categories[0].id,
        };

        const dashboardMetadata = {
            antigenCategory,
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
                teams: (antigen = null, orgUnit: { id: string }) => ({
                    categoryId: teamsMetadata.categoryId,
                    teams: teamsMetadata[orgUnit.id],
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
        categoryCodeForTeams,
    }: {
        dashboardId?: string;
        datasetName: string;
        organisationUnits: OrganisationUnitPathOnly[];
        antigens: Antigen[];
        startDate: Moment;
        endDate: Moment;
        categoryCodeForTeams: string;
    }): Promise<{ dashboard: DashboardData; charts: Array<object>; reportTables: Array<object> }> {
        const dashboardItemsMetadata = await this.getMetadataForDashboardItems(
            antigens,
            organisationUnits,
            categoryCodeForTeams
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
            dashboardItems: items,
        };

        return { dashboard, charts, reportTables };
    }

    createDashboardItems(
        datasetName: String,
        startDate: Moment,
        endDate: Moment,
        dashboardItemsMetadata: Dictionary<any>
    ): allDashboardElements {
        const { organisationUnitsWithName } = dashboardItemsMetadata;
        const organisationUnitsMetadata = organisationUnitsWithName.map((ou: OrganisationUnit) => ({
            id: ou.id,
            parents: { [ou.id]: ou.path },
            name: ou.displayName,
        }));
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
