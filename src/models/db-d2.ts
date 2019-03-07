import { Dictionary } from "lodash";
import moment from "moment";
import { D2, D2Api } from "./d2.types";
import {
    OrganisationUnit,
    PaginatedObjects,
    CategoryOption,
    CategoryCombo,
    DataElementGroup,
    MetadataResponse,
    Metadata,
    Attribute,
    Ref,
    OrganisationUnitPathOnly,
} from "./db.types";
import _ from "lodash";
import { qsIndicatorsTable, vaccinesTable, indicatorsChart, dashboardItemsConfig, itemsMetadataConstructor } from "./dashboard-items";
import { getDaysRange } from "../utils/date";

export default class DbD2 {
    d2: D2;
    api: D2Api;

    constructor(d2: D2) {
        this.d2 = d2;
        this.api = d2.Api.getApi();
    }

    public async getOrganisationUnitsFromIds(
        ids: string[]
    ): Promise<PaginatedObjects<OrganisationUnit>> {
        const pageSize = 10;
        const { pager, organisationUnits } = await this.api.get("/organisationUnits", {
            paging: true,
            pageSize: pageSize,
            filter: [
                `id:in:[${_(ids)
                    .take(pageSize)
                    .join(",")}]`,
            ],
            fields: ["id", "displayName", "path", "level", "ancestors[id,displayName,path,level]"],
        });
        const newPager = { ...pager, total: ids.length };
        return { pager: newPager, objects: organisationUnits };
    }

    public async getCategoryOptionsByCategoryCode(code: string): Promise<CategoryOption[]> {
        await this.getMetadataForDashboardItems();
        const { categories } = await this.api.get("/categories", {
            filter: [`code:in:[${code}]`],
            fields: ["categoryOptions[id,displayName,code]"],
        });

        if (_(categories).isEmpty()) {
            return [];
        } else {
            return _(categories[0].categoryOptions)
                .sortBy("displayName")
                .value();
        }
    }

    public async getCategoryCombosByCode(codes: string[]): Promise<CategoryCombo[]> {
        const { categoryCombos } = await this.api.get("/categoryCombos", {
            paging: false,
            filter: [`code:in:[${codes.join(",")}]`],
            fields: ["id,code,displayName"],
        });
        return categoryCombos;
    }

    public async getDataElementGroupsByCodes(codes: string[]): Promise<DataElementGroup[]> {
        const { dataElementGroups } = await this.api.get("/dataElementGroups", {
            filter: [`code:in:[${codes.join(",")}]`],
            fields: [
                "id,code,displayName,dataElements[id,code,displayName,categoryCombo[id,displayName,code]]",
            ],
        });
        return dataElementGroups;
    }

    public async postMetadata(metadata: Metadata): Promise<MetadataResponse> {
        const result = (await this.api.post("/metadata", metadata)) as MetadataResponse;
        return result;

        /*
        if (result.status === "OK" && metadata.dataSets) {
            metadata.dataSets.map(dataSet => {})
            this.api.post("/metadata", metadata) as MetadataResponse;
        }
        */
    }

    public async getAttributeIdByCode(code: string): Promise<Attribute | undefined> {
        const { attributes } = await this.api.get("/attributes", {
            paging: true,
            pageSize: 1,
            filter: [`code:eq:${code}`],
            fields: ["id"],
        });
        return attributes[0];
    }

    async getMetadataForDashboardItems() {
        const { categoryCode, tableDataElementCodes, chartIndicatorsCodes } = dashboardItemsConfig;
        const allDataElementCodes = _(tableDataElementCodes).values().flatten();
        const allIndicatorCodes = _(chartIndicatorsCodes).values().flatten();

        const { dataElements, categories, indicators } = await this.api.get("/metadata", {
            "categories:fields": "id",
            "categories:filter": `code:in:[${categoryCode}]`,
            "dataElements:fields": "id,code",
            "dataElements:filter": `code:in:[${allDataElementCodes.join(",")}]`,
            "indicators:fields": "id,code",
            "indicators:filter": `code:in:[${allIndicatorCodes.join(",")}]`,
        });

        const dashboardMetadata = {
            antigenCategory: categories[0].id,
            dataElements: {
                type: "DATA_ELEMENT",
                data: dataElements,
            },
            indicators: {
                type: "INDICATOR",
                data: indicators,
            }
        }
        console.log(dashboardMetadata);
        return dashboardMetadata;
    }

    public async createDashboard(
        name: String,
        organisationUnits: OrganisationUnitPathOnly[],
        antigens: CategoryOption[],
        datasetId: String,
        startDate: Date | null,
        endDate: Date | null
    ): Promise<Ref | undefined> {
        const dashboardItems = await this.createDashboardItems(
            name,
            organisationUnits,
            antigens,
            datasetId,
            startDate,
            endDate
        );
        // Pivot Table (reportTable) - For now a generic hardcoded table

        const dashboard = { name: `${name}_DASHBOARD`, dashboardItems };
        const {
            response: { uid },
        } = await this.api.post("/dashboards", dashboard);

        return { id: uid };
    }

    async createDashboardItems(
        name: String,
        organisationUnits: OrganisationUnitPathOnly[],
        antigens: CategoryOption[],
        datasetId: String,
        startDate: Date | null,
        endDate: Date | null
    ): Promise<Ref[]> {
        const organisationUnitsIds = organisationUnits.map(ou => ({ id: ou.id }));
        const organizationUnitsParents = _(organisationUnits).map(ou => [ou.id, ou.path]).fromPairs().value();
        const periodStart = startDate ? moment(startDate) : moment();
        const periodEnd = endDate ? moment(endDate) : moment().endOf("year");
        const periodRange = getDaysRange(periodStart, periodEnd);
        const period = periodRange.map(date => ({ id: date.format("YYYYMMDD") }));

        const dashboardItemsMetadata = await this.getMetadataForDashboardItems();
        const dashboardItemsElements = itemsMetadataConstructor(dashboardItemsMetadata);
        const { antigenCategory, ...elements } = dashboardItemsElements;
        console.log(elements);
        // One chart per antigen
        const charts = antigens.map(antigen =>
            indicatorsChart(
                name,
                antigen,
                datasetId,
                organisationUnitsIds,
                organizationUnitsParents,
                period,
                antigenCategory,
                elements.indicatorChart
            )
        );

        const tables = antigens.map(antigen =>
            [
                qsIndicatorsTable(
                    name,
                    antigen,
                    datasetId,
                    organisationUnitsIds,
                    period,
                    antigenCategory,
                    elements.qsTable,
                    ),
                vaccinesTable(
                    name,
                    antigen,
                    datasetId,
                    organisationUnitsIds,
                    period,
                    antigenCategory,
                    elements.vaccineTable,
                    ),
            ]
        );
        
        const resp = await this.api.post("/metadata", { charts, reportTables: _.flatten(tables) });
        console.log(resp);
        const appendCodes = dashboardItemsConfig.appendCodes;
        const chartCodes = antigens.map(({ id }) => `${datasetId}-${id}-${appendCodes.indicatorChart}`);
        const indicatorTableCodes = antigens.map(({ id }) => `${datasetId}-${id}-${appendCodes.qsTable}`);
        const vaccineTableCodes = antigens.map(({ id }) => `${datasetId}-${id}-${appendCodes.vTable}`);

        const { charts: chartIds, reportTables: tableIds } = await this.api.get("/metadata", {
            "charts:fields": "id",
            "charts:filter": `code:in:[${chartCodes.join(",")}]`,
            "reportTables:fields": "id",
            "reportTables:filter": `code:in:[${indicatorTableCodes.join(",")},${vaccineTableCodes.join(",")}]`,
        });

        const dashboardCharts = chartIds.map(({ id }: { id: string }) => ({
            type: "CHART",
            chart: { id },
        }));
        const dashboardTables = tableIds.map(({ id }: { id: string }) => ({
            type: "REPORT_TABLE",
            reportTable: { id },
        }));

        return [...dashboardCharts, ...dashboardTables];
    }
}
