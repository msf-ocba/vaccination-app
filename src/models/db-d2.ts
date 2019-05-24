import { AnalyticsResponse } from "./db-d2";
import { Dictionary } from "lodash";
import { D2, D2Api, DeleteResponse } from "./d2.types";
import {
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
    DataValueRequest,
    DataValueResponse,
    Response,
    DataValue,
    MetadataOptions,
    OrganisationUnitPathOnly,
} from "./db.types";
import _ from "lodash";
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
        formName: true,
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
    sections: { id: true },
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

    public async getTeamsForOrganisationUnits(
        organisationUnits: OrganisationUnitPathOnly[],
        categoryCodeForTeams: string
    ) {
        const organisationUnitIds = _.map(organisationUnits, "id");
        const { categoryOptions } = await this.api.get("/metadata", {
            "categoryOptions:fields": ":owner,categories[id,code]",
            "categoryOptions:filter": `organisationUnits.id:in:[${organisationUnitIds}]`,
        });

        if (_.isEmpty(categoryOptions)) return;

        const teams = categoryOptions.filter(
            (co: { categories: Array<{ id: string; code: string }> }) => {
                const categoryCodes = co.categories.map(c => c.code);
                return _.includes(categoryCodes, categoryCodeForTeams);
            }
        );
        console.log({ success: teams });
        return teams;
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

    public async postDataValues(dataValues: DataValue[]): Promise<Response<any>> {
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
            return { status: false, error: errorResponses };
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
