import _ from "lodash";
import "../utils/lodash-mixins";
import DbD2 from "./db-d2";
import {
    Category,
    DataElementGroup,
    CategoryCombo,
    CategoryOptionGroup,
    DataElement,
    OrganisationUnitLevel,
    Ref,
    CategoryOption,
    CategoryOptionCombo,
    Attribute,
    UserRole,
    CategoryOptionCombo,
    NamedObject,
} from "./db.types";
import { sortAgeGroups } from "../utils/age-groups";

export const baseConfig = {
    categoryCodeForAntigens: "RVC_ANTIGEN",
    categoryCodeForAgeGroup: "RVC_AGE_GROUP",
    categoryCodeForDoses: "RVC_DOSE",
    categoryComboCodeForAgeGroup: "RVC_AGE_GROUP",
    categoryComboCodeForAntigenAgeGroup: "RVC_ANTIGEN_AGE_GROUP",
    dataElementGroupCodeForAntigens: "RVC_ANTIGEN",
    categoryComboCodeForTeams: "RVC_TEAM",
    categoryCodeForTeams: "RVC_TEAM",
    attributeCodeForApp: "RVC_CREATED_BY_VACCINATION_APP",
    attributeCodeForDashboard: "RVC_DASHBOARD_ID",
    dataElementCodeForTotalPopulation: "RVC_TOTAL_POPULATION",
    dataElementCodeForAgeDistribution: "RVC_AGE_DISTRIBUTION",
    dataElementCodeForPopulationByAge: "RVC_POPULATION_BY_AGE",
    userRoleNames: {
        feedback: ["RVC Feedback"],
        targetPopulation: ["Medical Focal Point", "Field User", "Online Data Entry"],
    },
};

type BaseConfig = typeof baseConfig;

export interface MetadataConfig extends BaseConfig {
    userRoles: NamedObject[];
    attributes: {
        app: Attribute;
        dashboard: Attribute;
    };
    organisationUnitLevels: OrganisationUnitLevel[];
    categories: Category[];
    categoriesDisaggregation: Array<{
        name: string;
        code: string;
        dataDimensionType: "DISAGGREGATION" | "ATTRIBUTE";
        dataDimension: boolean;
        $categoryOptions:
            | { kind: "fromAntigens" }
            | { kind: "fromAgeGroups" }
            | { kind: "fromDoses" }
            | { kind: "values"; values: string[] };
    }>;
    defaults: {
        categoryOptionCombo: CategoryOptionCombo;
    };
    categoryOptions: CategoryOption[];
    categoryCombos: CategoryCombo[];
    population: {
        totalPopulationDataElement: DataElement;
        ageDistributionDataElement: DataElement;
        populationByAgeDataElement: DataElement;
        ageGroupCategory: Category;
    };
    dataElements: DataElement[];
    dataElementsDisaggregation: Array<{
        name: string;
        code: string;
        id: string;
        categories: { code: string; optional: boolean }[];
    }>;
    antigens: Array<{
        id: string;
        name: string;
        code: string;
        dataElements: { id: string; code: string; optional: boolean; order: number }[];
        ageGroups: Array<string[][]>;
        doses: Array<{ id: string; name: string }>;
    }>;
}

function getCategoriesDisaggregation(
    categories: Category[]
): MetadataConfig["categoriesDisaggregation"] {
    return categories.map(category => {
        let $categoryOptions: MetadataConfig["categoriesDisaggregation"][0]["$categoryOptions"];

        if (category.code === baseConfig.categoryCodeForAntigens) {
            $categoryOptions = { kind: "fromAntigens" };
        } else if (category.code === baseConfig.categoryCodeForAgeGroup) {
            $categoryOptions = { kind: "fromAgeGroups" };
        } else if (category.code === baseConfig.categoryCodeForDoses) {
            $categoryOptions = { kind: "fromDoses" };
        } else {
            $categoryOptions = {
                kind: "values",
                values: category.categoryOptions.map(co => co.displayName),
            };
        }

        return {
            id: category.id,
            name: category.displayName,
            code: category.code,
            dataDimensionType: category.dataDimensionType,
            dataDimension: category.dataDimension,
            $categoryOptions,
        };
    });
}

export function getCode(parts: string[]): string {
    const code = parts
        .map(part =>
            part
                .replace(/\s*/g, "")
                .replace(/^RVC_/, "")
                .toUpperCase()
        )
        .join("_");
    return "RVC_" + code;
}

function getFromRefs<T>(refs: Ref[], objects: T[]): T[] {
    const objectsById = _.keyBy(objects, "id");
    return refs.map(ref => _(objectsById).getOrFail(ref.id));
}

function getConfigDataElementsDisaggregation(
    dataElementGroups: DataElementGroup[],
    dataElements: DataElement[],
    categoryCombos: CategoryCombo[],
    categories: Category[]
): MetadataConfig["dataElementsDisaggregation"] {
    const groupsByCode = _.keyBy(dataElementGroups, "code");
    const catCombosByCode = _.keyBy(categoryCombos, "code");
    const dataElementsForAntigens = getFromRefs(
        _(groupsByCode).getOrFail(baseConfig.dataElementGroupCodeForAntigens).dataElements,
        dataElements
    );

    return dataElementsForAntigens.map(dataElement => {
        const getCategories = (typeString: string): Category[] => {
            const code = getCode(["RVC_DE", dataElement.code]) + "_" + typeString;
            const categoryRefs = (catCombosByCode[code] || { categories: [] }).categories;
            return getFromRefs(categoryRefs, categories);
        };

        const categoriesForAntigens = _.concat(
            getCategories("REQUIRED").map(({ code }) => ({ code, optional: false })),
            getCategories("OPTIONAL").map(({ code }) => ({ code, optional: true }))
        );

        return {
            id: dataElement.id,
            name: dataElement.displayName,
            code: dataElement.code,
            categories: categoriesForAntigens,
        };
    });
}

function getAntigens(
    dataElementGroups: DataElementGroup[],
    dataElements: DataElement[],
    categories: Category[],
    categoryOptionGroups: CategoryOptionGroup[]
): MetadataConfig["antigens"] {
    const categoriesByCode = _.keyBy(categories, "code");
    const categoryOptions = _(categoriesByCode).getOrFail(baseConfig.categoryCodeForAntigens)
        .categoryOptions;
    const dataElementGroupsByCode = _.keyBy(dataElementGroups, "code");
    const categoryOptionGroupsByCode = _.keyBy(categoryOptionGroups, "code");

    const antigensMetadata = categoryOptions.map(categoryOption => {
        const getDataElements = (typeString: string) => {
            const code = getCode([categoryOption.code, typeString]);
            const dataElementsForType = getFromRefs(
                _(dataElementGroupsByCode).getOrFail(code).dataElements,
                dataElements
            );
            return dataElementsForType.map(de => ({
                id: de.id,
                code: de.code,
                optional: typeString === "OPTIONAL",
                order: parseInt(de.formName.split(" - ")[1] || "0"), // formName: Name - INDEX
            }));
        };

        const dataElementsForAntigens = _.concat(
            getDataElements("REQUIRED"),
            getDataElements("OPTIONAL")
        );

        const dataElementSorted = _.orderBy(dataElementsForAntigens, "order");

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

        const dosesIds = _(categoryOptionGroupsByCode)
            .getOrFail(getCode([categoryOption.code, "DOSES"]))
            .categoryOptions.map(co => co.id);
        const allDoses = _(categoriesByCode).getOrFail(baseConfig.categoryCodeForDoses)
            .categoryOptions;
        const doses = _(allDoses)
            .map(co => (_(dosesIds).includes(co.id) ? { id: co.id, name: co.displayName } : null))
            .compact()
            .value();

        return {
            id: categoryOption.id,
            name: categoryOption.displayName,
            code: categoryOption.code,
            dataElements: dataElementSorted,
            ageGroups,
            doses,
        };
    });

    return antigensMetadata;
}

function getPopulationMetadata(
    dataElements: DataElement[],
    categories: Category[]
): MetadataConfig["population"] {
    const codes = [
        baseConfig.dataElementCodeForTotalPopulation,
        baseConfig.dataElementCodeForAgeDistribution,
        baseConfig.dataElementCodeForPopulationByAge,
    ];
    const [totalPopulationDataElement, ageDistributionDataElement, populationByAgeDataElement] = _(
        dataElements
    )
        .keyBy(de => de.code)
        .at(codes)
        .value();

    const ageGroupCategory = _(categories)
        .keyBy("code")
        .getOrFail(baseConfig.categoryCodeForAgeGroup);
    return {
        totalPopulationDataElement,
        ageDistributionDataElement,
        populationByAgeDataElement,
        ageGroupCategory,
    };
}

function getAttributes(attributes: Attribute[]) {
    const attributesByCode = _(attributes).keyBy("code");
    return {
        app: attributesByCode.getOrFail(baseConfig.attributeCodeForApp),
        dashboard: attributesByCode.getOrFail(baseConfig.attributeCodeForDashboard),
    };
}

function getDefaults(metadata: RawMetadataConfig): MetadataConfig["defaults"] {
    return {
        categoryOptionCombo: _(metadata.categoryOptionCombos)
            .keyBy("displayName")
            .getOrFail("default"),
    };
}

interface RawMetadataConfig {
    attributes: Attribute[];
    categories: Category[];
    categoryCombos: CategoryCombo[];
    categoryOptionCombos: CategoryOptionCombo[];
    categoryOptionGroups: CategoryOptionGroup[];
    dataElementGroups: DataElementGroup[];
    dataElements: DataElement[];
    organisationUnitLevels: OrganisationUnitLevel[];
    userRoles: NamedObject[];
}

export async function getMetadataConfig(db: DbD2): Promise<MetadataConfig> {
    const { feedback, targetPopulation } = baseConfig.userRoleNames;
    const userRoleNames = _.concat(feedback, targetPopulation);
    const userRolesFilter = "name:in:[" + userRoleNames.join(",") + "]";
    const codeFilter = "code:startsWith:RVC_";
    const modelParams = { filters: [codeFilter] };

    const metadataParams = {
        attributes: modelParams,
        categories: modelParams,
        categoryCombos: modelParams,
        categoryOptionGroups: modelParams,
        categoryOptionCombos: { filters: ["name:eq:default"] },
        dataElementGroups: modelParams,
        dataElements: modelParams,
        organisationUnitLevels: {},
        userRoles: { fields: { id: true, name: true }, filters: [userRolesFilter] },
    };

    const metadata = await db.getMetadata<RawMetadataConfig>(metadataParams);

    const metadataConfig = {
        ...baseConfig,
        attributes: getAttributes(metadata.attributes),
        organisationUnitLevels: metadata.organisationUnitLevels,
        categories: metadata.categories,
        categoriesDisaggregation: getCategoriesDisaggregation(metadata.categories),
        categoryOptions: _(metadata.categories)
            .flatMap("categoryOptions")
            .value(),
        categoryCombos: metadata.categoryCombos,
        dataElements: metadata.dataElements,
        dataElementsDisaggregation: getConfigDataElementsDisaggregation(
            metadata.dataElementGroups,
            metadata.dataElements,
            metadata.categoryCombos,
            metadata.categories
        ),
        defaults: getDefaults(metadata),
        antigens: getAntigens(
            metadata.dataElementGroups,
            metadata.dataElements,
            metadata.categories,
            metadata.categoryOptionGroups
        ),
        population: getPopulationMetadata(metadata.dataElements, metadata.categories),
        userRoles: metadata.userRoles,
    };

    return metadataConfig;
}
