import _ from "lodash";
import { D2, D2Api } from "./d2.types";
import {
    OrganisationUnit,
    PaginatedObjects,
    CategoryOption,
    CategoryCombo,
    DataElementGroup,
    MetadataResponse,
    Metadata,
    ModelFields,
    MetadataGetParams,
    MetadataGetModelParams,
} from "./db.types";

function getDbFields(modelFields: ModelFields): string[] {
    return _(modelFields)
        .map((value, key) => {
            if (typeof value === "boolean") {
                return value ? key : null;
            } else {
                return key + "[" + getDbFields(value).join(",") + "]";
            }
        })
        .compact()
        .value();
}

function toDbParams(metadataParams: MetadataGetParams): string[] {
    const data: Array<[keyof MetadataGetParams, MetadataGetModelParams]> = [
        ["categories", metadataParams.categories],
    ];

    return _.flatMap(data, ([modelName, params]) => [
        `${modelName}:fields=${getDbFields(params.fields).join(",")}`,
        ...(params.filters || []).map(filter => `${modelName}:filter=${filter}`),
    ]);
}

export default class DbD2 {
    d2: D2;
    api: D2Api;

    constructor(d2: D2) {
        this.d2 = d2;
        this.api = d2.Api.getApi();
    }

    public async getMetadata<T>(params: MetadataGetParams): Promise<T> {
        return this.api.get("/metadata", toDbParams(params)) as T;
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

    public async getDataElementGroupsByCodes(codes: string[]): Promise<DataElementGroup[]> {
        const { dataElementGroups } = await this.api.get("/dataElementGroups", {
            paging: false,
            filter: [`code:in:[${codes.join(",")}]`],
            fields: [
                "id",
                "name",
                "code",
                "dataElements[id,code,displayName,categoryCombo[id,code,displayName,categories[id,displayName,categoryOptions[id,displayName]]]]",
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
}
