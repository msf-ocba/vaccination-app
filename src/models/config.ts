import _ from "lodash";
import "../utils/lodash-mixins";
import DbD2 from "./db-d2";
import { Category, DataElementGroup, CategoryCombo, CategoryOptionGroup } from "./db.types";

export interface BaseConfig {
    categoryCodeForAntigens: string;
    categoryCodeForAgeGroup: string;
    dataElementGroupCodeForAntigens: string;
    categoryComboCodeForTeams: string;
    attibuteCodeForApp: string;
    attributeCodeForDashboard: string;
}

const baseConfig: BaseConfig = {
    categoryCodeForAntigens: "RVC_ANTIGEN",
    categoryCodeForAgeGroup: "RVC_AGE_GROUP",
    dataElementGroupCodeForAntigens: "RVC_ANTIGEN",
    categoryComboCodeForTeams: "RVC_TEAM",
    attibuteCodeForApp: "RVC_CREATED_BY_VACCINATION_APP",
    attributeCodeForDashboard: "RVC_DASHBOARD_ID",
};

export interface MetadataConfig extends BaseConfig {
    categories: Array<{
        name: string;
        code: string;
        dataDimensionType: "DISAGGREGATION" | "ATTRIBUTE";
        dataDimension: boolean;
        $categoryOptions:
            | { kind: "fromAntigens" }
            | { kind: "fromAgeGroups" }
            | { kind: "values"; values: string[] };
    }>;
    dataElements: Array<{
        name: string;
        code: string;
        id: string;
        categories: { code: string; optional: boolean }[];
    }>;
    antigens: Array<{
        name: string;
        code: string;
        dataElements: { code: string; optional: boolean }[];
        ageGroups: Array<string[][]>;
    }>;
}

function getConfigCategories(categories: Category[]): MetadataConfig["categories"] {
    return categories.map(category => {
        let $categoryOptions: MetadataConfig["categories"][0]["$categoryOptions"];

        if (category.code === baseConfig.categoryCodeForAntigens) {
            $categoryOptions = { kind: "fromAntigens" };
        } else if (category.code === baseConfig.categoryCodeForAgeGroup) {
            $categoryOptions = { kind: "fromAgeGroups" };
        } else {
            $categoryOptions = {
                kind: "values",
                values: category.categoryOptions.map(co => co.displayName),
            };
        }

        return {
            name: category.displayName,
            code: category.code,
            dataDimensionType: category.dataDimensionType,
            dataDimension: category.dataDimension,
            $categoryOptions,
        };
    });
}

function getCode(parts: string[]): string {
    return parts.map(part => part.replace(/\s*/g, "").toUpperCase()).join("_");
}

function getConfigDataElements(
    dataElementGroups: DataElementGroup[],
    categoryCombos: CategoryCombo[]
): MetadataConfig["dataElements"] {
    const groupsByCode = _.keyBy(dataElementGroups, "code");
    const catCombosByCode = _.keyBy(categoryCombos, "code");
    const dataElements = _(groupsByCode).getOrFail("RVC_ANTIGEN").dataElements;

    return dataElements.map(dataElement => {
        const getCategories = (typeString: string) => {
            const code = "RVC_DE_" + dataElement.code + "_" + typeString;
            return (catCombosByCode[code] || { categories: [] }).categories;
        };

        const categories = _.concat(
            getCategories("REQUIRED").map(({ code }) => ({ code, optional: false })),
            getCategories("OPTIONAL").map(({ code }) => ({ code, optional: true }))
        );

        return {
            id: dataElement.id,
            name: dataElement.displayName,
            code: dataElement.code,
            categories,
        };
    });
}

function sortAgeGroups(names: string[]): string[] {
    const timeUnits = ["d", "w", "m", "y"];
    return _.sortBy(names, name => {
        const parts = name.split(" ");
        const timeOrder = timeUnits.indexOf(_.last(parts) || "y") || timeUnits.length;
        return 1000 * timeOrder + parseInt(parts[0]);
    });
}

function getAntigens(
    dataElementGroups: DataElementGroup[],
    categories: Category[],
    categoryOptionGroups: CategoryOptionGroup[]
): MetadataConfig["antigens"] {
    const categoriesByCode = _.keyBy(categories, "code");
    const categoryOptions = _(categoriesByCode).getOrFail("RVC_ANTIGEN").categoryOptions;
    const dataElementGroupsByCode = _.keyBy(dataElementGroups, "code");
    const categoryOptionGroupsByCode = _.keyBy(categoryOptionGroups, "code");

    return categoryOptions.map(categoryOption => {
        const getDataElements = (typeString: string) => {
            const code = getCode([categoryOption.code, typeString]);
            return _(dataElementGroupsByCode).getOrFail(code).dataElements;
        };

        const dataElements = _.concat(
            getDataElements("REQUIRED").map(({ code }) => ({ code, optional: false })),
            getDataElements("OPTIONAL").map(({ code }) => ({ code, optional: true }))
        );

        const dataElementSorted = _(dataElements)
            .orderBy([de => de.code.match(/DOSES/), "code"], ["asc", "asc"])
            .value();

        const mainAgeGroups = _(categoryOptionGroupsByCode)
            .getOrFail(getCode([categoryOption.code, "AGE_GROUP"]))
            .categoryOptions.map(co => co.displayName);

        const ageGroups = sortAgeGroups(mainAgeGroups).map(mainAgeGroup => {
            const codePrefix = getCode([categoryOption.code, "AGE_GROUP", mainAgeGroup]);
            const disaggregatedAgeGroups = _(categoryOptionGroups)
                .filter(cog => cog.code.startsWith(codePrefix))
                .sortBy(cog => cog.code)
                .map(cog => sortAgeGroups(cog.categoryOptions.map(co => co.displayName)))
                .value();
            return [[mainAgeGroup], ...disaggregatedAgeGroups];
        });

        return {
            name: categoryOption.displayName,
            code: categoryOption.code,
            dataElements: dataElementSorted,
            ageGroups: ageGroups,
        };
    });
}

export async function getMetadataConfig(db: DbD2): Promise<MetadataConfig> {
    const codeFilter = "code:startsWith:RVC_";
    const modelParams = { filters: [codeFilter] };

    const metadataParams = {
        categories: modelParams,
        categoryCombos: modelParams,
        categoryOptionGroups: modelParams,
        dataElementGroups: modelParams,
    };

    const metadata = await db.getMetadata<{
        categories: Category[];
        categoryCombos: CategoryCombo[];
        categoryOptionGroups: CategoryOptionGroup[];
        dataElementGroups: DataElementGroup[];
    }>(metadataParams);

    return {
        ...baseConfig,
        categories: getConfigCategories(metadata.categories),
        dataElements: getConfigDataElements(metadata.dataElementGroups, metadata.categoryCombos),
        antigens: getAntigens(
            metadata.dataElementGroups,
            metadata.categories,
            metadata.categoryOptionGroups
        ),
    };
}
