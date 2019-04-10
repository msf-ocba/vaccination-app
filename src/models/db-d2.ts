import { AnalyticsResponse } from "./db-d2";
import { Dictionary } from "lodash";
import moment from "moment";
import { generateUid } from "d2/uid";
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
    DataEntryForm,
    OrganisationUnitPathOnly,
    DashboardData,
    DataValueRequest,
    DataValueResponse,
    Response,
    DataValue,
} from "./db.types";
import _ from "lodash";
import {
    dashboardItemsConfig,
    itemsMetadataConstructor,
    buildDashboardItems,
} from "./dashboard-items";
import { getDaysRange } from "../utils/date";
import { Antigen } from "./campaign";
import "../utils/lodash-mixins";
import { promiseMap } from "../utils/promises";

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

export interface AnalyticsRequest {
    dimension: string[];
    filter?: string[];
    skipMeta?: boolean;
}

export interface AnalyticsResponse {
    headers: Array<{
        name: "dx" | "dy";
        column: "Data";
        valueType: "TEXT" | "NUMBER";
        type: "java.lang.String" | "java.lang.Double";
        hidden: boolean;
        meta: boolean;
    }>;

    rows: Array<string[]>;
    width: number;
    height: number;
}

const ref = { id: true };

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
        categoryOptionCombos: { id: true, name: true, categoryOptions: { id: true } },
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
        dataElements: ref,
    },
    organisationUnits: {
        id: true,
        displayName: true,
        path: true,
        level: true,
        ancestors: {
            id: true,
            displayName: true,
            path: true,
            level: true,
        },
    },
    organisationUnitLevels: {
        id: true,
        displayName: true,
        level: true,
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
        const metadata = await this.api.get("/metadata", options);
        const metadataWithEmptyRecords = _(params)
            .keys()
            .map(key => [key, metadata[key] || []])
            .fromPairs()
            .value();
        return metadataWithEmptyRecords as T;
    }

    public async getOrganisationUnitsFromIds(
        ids: string[],
        options: { pageSize?: number }
    ): Promise<PaginatedObjects<OrganisationUnit>> {
        const { pager, organisationUnits } = await this.api.get("/organisationUnits", {
            paging: true,
            pageSize: options.pageSize || 10,
            filter: [
                `id:in:[${_(ids)
                    .take(options.pageSize)
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
        return this.api.post("/metadata", metadata) as Promise<MetadataResponse>;
    }

    public async postForm(dataSetId: string, dataEntryForm: DataEntryForm): Promise<boolean> {
        await this.api.post(["dataSets", dataSetId, "form"].join("/"), dataEntryForm);
        return true;
    }

    public async postDataValues(dataValues: DataValue[]): Promise<Response<string[]>> {
        const dataValueRequests: DataValueRequest[] = _(dataValues)
            .groupBy(dv => {
                const parts = [
                    dv.dataSet,
                    dv.completeDate,
                    dv.period,
                    dv.orgUnit,
                    dv.attributeOptionCombo,
                ];
                return parts.join("-");
            })
            .values()
            .map(group => {
                const dv0 = group[0];
                return {
                    dataSet: dv0.dataSet,
                    completeDate: dv0.completeDate,
                    period: dv0.period,
                    orgUnit: dv0.orgUnit,
                    attributeOptionCombo: dv0.attributeOptionCombo,
                    dataValues: group.map(dv => ({
                        dataElement: dv.dataElement,
                        categoryOptionCombo: dv.categoryOptionCombo,
                        value: dv.value,
                        comment: dv.comment,
                    })),
                };
            })
            .value();

        const responses = await promiseMap(dataValueRequests, dataValueRequest => {
            return this.api.post("dataValueSets", dataValueRequest) as Promise<DataValueResponse>;
        });
        const errorResponses = responses.filter(response => response.status !== "SUCCESS");

        if (_(errorResponses).isEmpty()) {
            return { status: true };
        } else {
            return { status: false, error: errorResponses.map(response => response.description) };
        }
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
    ): Promise<DashboardData> {
        const dashboardItemsMetadata = await this.getMetadataForDashboardItems(antigens);

        const dashboardItems = this.createDashboardItems(
            name,
            organisationUnits,
            datasetId,
            startDate,
            endDate,
            dashboardItemsMetadata
        );

        const keys: Array<keyof DashboardData> = ["items", "charts", "reportTables"];
        const { items, charts, reportTables } = _(keys)
            .map(key => [key, _(dashboardItems).getOrFail(key)])
            .fromPairs()
            .value();

        const dashboard = { id: generateUid(), name: `${name}_DASHBOARD`, dashboardItems: items };

        return { dashboard, charts, reportTables };
    }

    createDashboardItems(
        name: String,
        organisationUnits: OrganisationUnitPathOnly[],
        datasetId: String,
        startDate: Date | null,
        endDate: Date | null,
        dashboardItemsMetadata: Dictionary<any>
    ): DashboardData {
        const organisationUnitsIds = organisationUnits.map(ou => ({ id: ou.id }));
        const organizationUnitsParents = _(organisationUnits)
            .map(ou => [ou.id, ou.path])
            .fromPairs()
            .value();
        const periodStart = startDate ? moment(startDate) : moment();
        const periodEnd = endDate ? moment(endDate) : moment().endOf("year");
        const periodRange = getDaysRange(periodStart, periodEnd);
        const period = periodRange.map(date => ({ id: date.format("YYYYMMDD") }));
        const antigensMeta = _(dashboardItemsMetadata).getOrFail("antigensMeta");
        const dashboardItemsElements = itemsMetadataConstructor(dashboardItemsMetadata);

        const expectedCharts = _(dashboardItemsConfig.appendCodes)
            .keys()
            .value();

        const keys = ["antigenCategory", ...expectedCharts] as Array<
            keyof typeof dashboardItemsElements
        >;
        const { antigenCategory, ...elements } = _(keys)
            .map(key => [key, _(dashboardItemsElements).getOrFail(key)])
            .fromPairs()
            .value();

        const dashboardItems = buildDashboardItems(
            antigensMeta,
            name,
            datasetId,
            organisationUnitsIds,
            organizationUnitsParents,
            period,
            antigenCategory,
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

    public getAnalytics(request: AnalyticsRequest): Promise<AnalyticsResponse> {
        return this.api.get("/analytics", request) as Promise<AnalyticsResponse>;
    }
}
