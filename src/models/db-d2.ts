import { AnalyticsResponse } from "./db-d2";
import { Moment } from "moment";
import { Dictionary } from "lodash";
import { generateUid } from "d2/uid";
import { D2, D2Api, DeleteResponse } from "./d2.types";
import {
    Ref,
    OrganisationUnit,
    PaginatedObjects,
    CategoryOption,
    CategoryCombo,
    MetadataResponse,
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
    MetadataOptions,
    DashboardMetadataRequest,
    OrganisationUnitWithName,
    CategoryOptionsCustom,
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
import { AntigenDisaggregationEnabled } from "./AntigensDisaggregation";

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
            if (!params) {
                return [];
            } else {
                const fields = params.fields || metadataFields[modelName as ModelName];
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

export const metadataFields: MetadataFields = {
    attributeValues: {
        value: true,
        attribute: { id: true, code: true },
    },
    attributes: {
        id: true,
        code: true,
        valueType: true,
        displayName: true,
    },
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
        categories: ref,
        categoryOptionCombos: { id: true, name: true },
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
    dashboards: {
        id: true,
        dashboardItems: {
            id: true,
            chart: { id: true },
            map: { id: true },
            reportTable: { id: true },
        },
    },
    dataElements: {
        id: true,
        code: true,
        displayName: true,
        categoryCombo: metadataFields => metadataFields.categoryCombos,
    },
    dataSetElements: {
        dataSet: ref,
        dataElement: ref,
        categoryCombo: ref,
    },
    dataInputPeriods: {
        openingDate: true,
        closingDate: true,
        period: { id: true },
    },
    dataSets: {
        id: true,
        name: true,
        description: true,
        publicAccess: true,
        periodType: true,
        categoryCombo: ref,
        dataElementDecoration: true,
        renderAsTabs: true,
        organisationUnits: ref,
        dataSetElements: metadataFields => metadataFields.dataSetElements,
        openFuturePeriods: true,
        timelyDays: true,
        expiryDays: true,
        sections: ref,
        dataInputPeriods: metadataFields => metadataFields.dataInputPeriods,
        attributeValues: metadataFields => metadataFields.attributeValues,
        formType: true,
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

export type ApiResponse<Value> = { status: true; value: Value } | { status: false; error: string };

export type ModelReference = { model: string; id: string };

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

    public async validateTeamsForOrganisationUnits(
        organisationUnits: OrganisationUnitPathOnly[],
        categoryCodeForTeams: string
    ) {
        const allAncestorsIds = _(organisationUnits)
            .map("path")
            .flatMap(path => path.split("/").slice(1))
            .uniq()
            .value()
            .join(",");
        const organisationUnitsIds = _.map(organisationUnits, "id");
        const response = await this.api.get("/metadata", {
            "categoryOptions:fields": "id,categories[code],organisationUnits[id]",
            "categoryOptions:filter": `organisationUnits.id:in:[${allAncestorsIds}]`, //Missing categoryTeamCode
            "organisationUnits:fields": "id,displayName",
            "organisationUnits:filter": `id:in:[${organisationUnitsIds}]`,
        });

        const { categoryOptions, organisationUnits: orgUnitNamesArray } = response as {
            categoryOptions?: CategoryOptionsCustom[];
            organisationUnits?: OrganisationUnitWithName[];
        };

        const hasTeams = (path: string) => {
            return (categoryOptions || []).some(
                categoryOption =>
                    _(categoryOption.categories)
                        .map("code")
                        .includes(categoryCodeForTeams) &&
                    categoryOption.organisationUnits.some(ou => path.includes(ou.id))
            );
        };

        const orgUnitNames: _.Dictionary<string> = _(orgUnitNamesArray)
            .map(o => [o.id, o.displayName])
            .fromPairs()
            .value();

        return _(organisationUnits || [])
            .map(ou => ({
                id: ou.id,
                displayName: _(orgUnitNames).getOrFail(ou.id),
                hasTeams: hasTeams(ou.path),
            }))
            .value();
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

    public async postMetadata<Metadata>(
        metadata: Metadata,
        options: MetadataOptions = {}
    ): Promise<ApiResponse<MetadataResponse>> {
        const queryString = _(options).isEmpty()
            ? ""
            : "?" +
              _(options as object[])
                  .map((value, key) => `${key}=${value}`)
                  .join("&");
        try {
            const response = (await this.api.post(
                "/metadata" + queryString,
                metadata
            )) as MetadataResponse;
            return { status: true, value: response };
        } catch (err) {
            return { status: false, error: err.message || err.toString() };
        }
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

    public async deleteMany(modelReferences: ModelReference[]): Promise<Response<string>> {
        const errors = _.compact(
            await promiseMap(modelReferences, async ({ model, id }) => {
                const { httpStatus, httpStatusCode, status, message } = await this.api
                    .delete(`/${model}/${id}`)
                    .catch((err: DeleteResponse) => {
                        if (err.httpStatusCode) {
                            return err;
                        } else {
                            throw err;
                        }
                    });

                if (httpStatusCode === 404) {
                    return null;
                } else if (status !== "OK") {
                    return message || `${httpStatus} (${httpStatusCode})`;
                } else {
                    return null;
                }
            })
        );

        return _(errors).isEmpty()
            ? { status: true }
            : {
                  status: false,
                  error: errors.join("\n"),
              };
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

    async getMetadataForDashboardItems(
        antigens: Antigen[],
        organisationUnitsPathOnly: OrganisationUnitPathOnly[],
        categoryCodeForTeams: string,
        antigensDissagregation: AntigenDisaggregationEnabled,
        categoryOptions: CategoryOption[],
        ageGroupCategoryId: string
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
        const { antigenCategoryCode } = dashboardItemsConfig;

        const {
            categories,
            dataElements,
            indicators,
            categoryOptions: teamOptions,
            organisationUnits: organisationUnitsWithName,
        } = await this.api.get<{
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
            "categories:filter": `code:in:[${antigenCategoryCode},${categoryCodeForTeams}]`,
            "dataElements:fields": "id,code",
            "dataElements:filter": `code:in:[${allDataElementCodes}]`,
            "indicators:fields": "id,code",
            "indicators:filter": `code:in:[${allIndicatorCodes}]`,
            "categoryOptions:fields": "id,categories[id,code],organisationUnits[id]",
            "categoryOptions:filter": `organisationUnits.id:in:[${allAncestorsIds}]`,
            "organisationUnits:fields": "id,displayName,path",
            "organisationUnits:filter": `id:in:[${orgUnitsId}]`,
        });

        const categoriesByCode = _(categories).keyBy(category => category.code);
        const antigenCategory = categoriesByCode.getOrFail(antigenCategoryCode);
        const teamsCategory = categoriesByCode.getOrFail(categoryCodeForTeams);

        const antigensMeta = _.filter(antigenCategory.categoryOptions, op =>
            _.includes(antigenCodes, op.code)
        );

        if (!teamOptions) {
            throw new Error("Organization Units chosen have no teams associated");
        }

        const teamsByOrgUnit: { [orgUnitId: string]: string[] } = organisationUnitsPathOnly.reduce(
            (acc, ou) => {
                let teams: string[] = [];
                teamOptions.forEach(categoryOption => {
                    const coIsTeam = _(categoryOption.categories)
                        .map("code")
                        .includes(categoryCodeForTeams);
                    const coIncludesOrgUnit = _(categoryOption.organisationUnits)
                        .map("id")
                        .some((coOu: string) => ou.path.includes(coOu));

                    if (coIsTeam && coIncludesOrgUnit) {
                        teams.push(categoryOption.id);
                    }
                });
                return { ...acc, [ou.id]: teams };
            },
            {}
        );

        const categoryOptionsByName: _.Dictionary<string> = _(categoryOptions)
            .map(co => [co.displayName, co.id])
            .fromPairs()
            .value();

        const ageGroupsToId = (ageGroups: string[]): string[] =>
            _.map(ageGroups, ag => categoryOptionsByName[ag]);

        const ageGroupsByAntigen: _.Dictionary<string[]> = _(antigensDissagregation)
            .map(d => [d.antigen.id, ageGroupsToId(d.ageGroups)])
            .fromPairs()
            .value();

        const teamsMetadata = {
            teamsByOrgUnit,
            categoryId: teamsCategory.id,
        };

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
                teams: (_antigen = null, orgUnit: Ref) => ({
                    categoryId: teamsMetadata.categoryId,
                    elements: teamsMetadata.teamsByOrgUnit[orgUnit.id],
                }),
                ageGroups: (antigen: Ref) => ({
                    categoryId: ageGroupCategoryId,
                    elements: ageGroupsByAntigen[antigen.id],
                }),
            },
        };

        return dashboardMetadata;
    }

    public async createDashboard(
        datasetName: String,
        organisationUnits: OrganisationUnitPathOnly[],
        antigens: Antigen[],
        startDate: Moment,
        endDate: Moment,
        categoryCodeForTeams: string,
        antigensDissagregation: AntigenDisaggregationEnabled,
        categoryOptions: CategoryOption[],
        ageGroupCategoryId: string
    ): Promise<DashboardData> {
        const dashboardItemsMetadata = await this.getMetadataForDashboardItems(
            antigens,
            organisationUnits,
            categoryCodeForTeams,
            antigensDissagregation,
            categoryOptions,
            ageGroupCategoryId
        );

        const dashboardItems = this.createDashboardItems(
            datasetName,
            startDate,
            endDate,
            dashboardItemsMetadata
        );

        const keys: Array<keyof DashboardData> = ["items", "charts", "reportTables"];
        const { items, charts, reportTables } = _(keys)
            .map(key => [key, _(dashboardItems).getOrFail(key)])
            .fromPairs()
            .value();

        const dashboard = {
            id: generateUid(),
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
    ): DashboardData {
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

    public getAnalytics(request: AnalyticsRequest): Promise<AnalyticsResponse> {
        return this.api.get("/analytics", request) as Promise<AnalyticsResponse>;
    }
}

export function toStatusResponse(response: ApiResponse<MetadataResponse>): Response<string> {
    if (!response.status) {
        return { status: false, error: response.error };
    } else if (response.value.status === "OK") {
        return { status: true };
    } else {
        const errors = _(response.value.typeReports)
            .flatMap(tr => tr.objectReports)
            .flatMap(or => or.errorReports)
            .map("message")
            .value();

        return { status: false, error: errors.join("\n") };
    }
}
