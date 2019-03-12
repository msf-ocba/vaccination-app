import { Dictionary } from "lodash";
import moment from "moment";
import { D2, D2Api } from "./d2.types";
import {
    OrganisationUnit,
    PaginatedObjects,
    CategoryOption,
    CategoryCombo,
    MetadataResponse,
    Metadata,
    ModelFields,
    MetadataGetParams,
    ModelName,
    MetadataFields,
    Attribute,
    Ref,
    OrganisationUnitPathOnly,
} from "./db.types";
import _ from "lodash";
import {
    dashboardItemsConfig,
    itemsMetadataConstructor,
    buildDashboardItems,
    buildDashboardItemsCode,
} from "./dashboard-items";
import { getDaysRange } from "../utils/date";
import { Antigen } from "./campaign";

function getDbFields(modelFields: ModelFields): string[] {
    return _(modelFields)
        .map((value, key) => {
            if (typeof value === "function") {
                return key + "[" + getDbFields(value(metadataFields)).join(",") + "]";
            } else if (typeof value === "boolean") {
                return value ? key : null;
            } else {
                return key + "[" + getDbFields(value).join(",") + "]";
            }
        })
        .compact()
        .value();
}

function toDbParams(metadataParams: MetadataGetParams): Dictionary<string> {
    return _(metadataParams)
        .flatMap((params, modelName) => {
            const fields = metadataFields[modelName as ModelName];
            if (!params) {
                return [];
            } else {
                return [
                    [modelName + ":fields", getDbFields(fields).join(",")],
                    ...(params.filters || []).map(filter => [modelName + ":filter", filter]),
                ];
            }
        })
        .fromPairs()
        .value();
}

const metadataFields: MetadataFields = {
    categories: {
        id: true,
        displayName: true,
        code: true,
        dataDimensionType: true,
        dataDimension: true,
        categoryOptions: {
            id: true,
            code: true,
            displayName: true,
        },
    },
    categoryCombos: {
        id: true,
        displayName: true,
        code: true,
        categories: metadataFields => metadataFields.categories,
    },
    categoryOptions: {
        id: true,
        displayName: true,
        code: true,
    },
    categoryOptionGroups: {
        id: true,
        displayName: true,
        code: true,
        categoryOptions: metadataFields => metadataFields.categoryOptions,
    },
    dataElements: {
        id: true,
        code: true,
        displayName: true,
        categoryCombo: metadataFields => metadataFields.categoryCombos,
    },
    dataElementGroups: {
        id: true,
        displayName: true,
        code: true,
        dataElements: metadataFields => metadataFields.dataElements,
    },
};

export default class DbD2 {
    d2: D2;
    api: D2Api;

    constructor(d2: D2) {
        this.d2 = d2;
        this.api = d2.Api.getApi();
    }

    public async getMetadata<T>(params: MetadataGetParams): Promise<T> {
        const options = { translate: true, ...toDbParams(params) };
        return this.api.get("/metadata", options) as T;
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
        const { categories } = await this.api.get("/categories", {
            filter: [`code:in:[${code}]`],
            fields: ["categoryOptions[id,displayName,code,dataDimension,dataDimensionType]"],
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

    async getMetadataForDashboardItems(antigens: Antigen[]) {
        const { categoryCode, tablesDataCodes, chartsDataCodes } = dashboardItemsConfig;
        const allDataElementCodes = _(tablesDataCodes)
            .values()
            .flatten();
        const allIndicatorCodes = _(chartsDataCodes)
            .values()
            .flatten();
        const antigenCodes = antigens.map(an => an.code);
        const { dataElements, categories, indicators } = await this.api.get("/metadata", {
            "categories:fields": "id,categoryOptions[id,code,name]",
            "categories:filter": `code:in:[${categoryCode}]`,
            "dataElements:fields": "id,code",
            "dataElements:filter": `code:in:[${allDataElementCodes.join(",")}]`,
            "indicators:fields": "id,code",
            "indicators:filter": `code:in:[${allIndicatorCodes.join(",")}]`,
        });
        const { id: categoryId, categoryOptions } = categories[0];
        const antigensMeta = _.filter(categoryOptions, op => _.includes(antigenCodes, op.code));
        const dashboardMetadata = {
            antigenCategory: categoryId,
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
        };
        return dashboardMetadata;
    }

    public async createDashboard(
        name: String,
        organisationUnits: OrganisationUnitPathOnly[],
        antigens: Antigen[],
        datasetId: String,
        startDate: Date | null,
        endDate: Date | null
    ): Promise<Ref | undefined> {
        const dashboardItemsMetadata = await this.getMetadataForDashboardItems(antigens);

        const dashboardItems = await this.createDashboardItems(
            name,
            organisationUnits,
            datasetId,
            startDate,
            endDate,
            dashboardItemsMetadata
        );

        const dashboard = { name: `${name}_DASHBOARD`, dashboardItems };
        const {
            response: { uid },
        } = await this.api.post("/dashboards", dashboard);

        return { id: uid };
    }

    async createDashboardItems(
        name: String,
        organisationUnits: OrganisationUnitPathOnly[],
        datasetId: String,
        startDate: Date | null,
        endDate: Date | null,
        dashboardItemsMetadata: Dictionary<any>
    ): Promise<Ref[]> {
        const organisationUnitsIds = organisationUnits.map(ou => ({ id: ou.id }));
        const organizationUnitsParents = _(organisationUnits)
            .map(ou => [ou.id, ou.path])
            .fromPairs()
            .value();
        const periodStart = startDate ? moment(startDate) : moment();
        const periodEnd = endDate ? moment(endDate) : moment().endOf("year");
        const periodRange = getDaysRange(periodStart, periodEnd);
        const period = periodRange.map(date => ({ id: date.format("YYYYMMDD") }));
        const { antigensMeta } = dashboardItemsMetadata;
        const dashboardItemsElements = itemsMetadataConstructor(dashboardItemsMetadata);
        const { antigenCategory, ...elements } = dashboardItemsElements;

        const { charts, reportTables } = buildDashboardItems(
            antigensMeta,
            name,
            datasetId,
            organisationUnitsIds,
            organizationUnitsParents,
            period,
            antigenCategory,
            elements
        );

        await this.api.post("/metadata", { charts, reportTables });

        // Search for dashboardItems ids
        const appendCodes: { [key: string]: string } = dashboardItemsConfig.appendCodes;
        const chartKeys = _.keys(dashboardItemsConfig.chartsDataCodes);
        const tableKeys = _.keys(dashboardItemsConfig.tablesDataCodes);

        const chartCodes = chartKeys.map(key =>
            antigensMeta.map(({ id }: { id: string }) => buildDashboardItemsCode(datasetId, id, appendCodes[key]))
        );

        const tableCodes = tableKeys.map(key =>
            antigensMeta.map(({ id }: { id: string }) => buildDashboardItemsCode(datasetId, id, appendCodes[key]))
        );

        const { charts: chartIds, reportTables: tableIds } = await this.api.get("/metadata", {
            "charts:fields": "id",
            "charts:filter": `code:in:[${chartCodes.join(",")}]`,
            "reportTables:fields": "id",
            "reportTables:filter": `code:in:[${tableCodes.join(",")}]`,
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
