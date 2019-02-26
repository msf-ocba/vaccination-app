import DbD2 from "./db-d2";
import { Category } from "./db.types";

export interface MetadataConfig {
    categoryCodeForAntigens: string;
    categoryComboCodeForTeams: string;
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
        categories: { code: string; optional: boolean }[];
    }>;
    antigens: Array<{
        name: string;
        code: string;
        dataElements: { code: string; optional: boolean }[];
        ageGroups: string[][][];
    }>;
}

const metadataConfigBase: MetadataConfig = {
    categoryCodeForAntigens: "RVC_ANTIGENS",
    categoryComboCodeForTeams: "RVC_TEAMS",
    categories: [],
    dataElements: [
        {
            name: "Vaccine doses administered",
            code: "RVC_DOSES_ADMINISTERED",
            categories: [
                { code: "RVC_AGE_GROUP", optional: false },
                { code: "RVC_GENDER", optional: true },
                { code: "RVC_DISPLACEMENT_STATUS", optional: true },
            ],
        },
        {
            name: "Vaccine doses used",
            code: "RVC_DOSES_USED",
            categories: [],
        },
        {
            name: "ADS used",
            code: "RVC_ADS_USED",
            categories: [],
        },
        {
            name: "Syringes for dilution",
            code: "RVC_SYRINGES",
            categories: [],
        },
        {
            name: "Needles doses used",
            code: "RVC_NEEDLES",
            categories: [],
        },
        {
            name: "Safety boxes",
            code: "RVC_SAFETY_BOXES",
            categories: [],
        },
        {
            name: "Accidental Exposure to Blood (AEB)",
            code: "RVC_AEB",
            categories: [],
        },
        {
            name: "Adverse Event Following Immunization",
            code: "RVC_AEFI",
            categories: [{ code: "RVC_SEVERITY", optional: true }],
        },
    ],
    antigens: [
        {
            name: "Measles",
            code: "RVC_MEASLES",
            dataElements: [
                { code: "RVC_DOSES_ADMINISTERED", optional: false },
                { code: "RVC_DOSES_USED", optional: false },
                { code: "RVC_ADS_USED", optional: true },
                { code: "RVC_SYRINGES", optional: false },
                { code: "RVC_NEEDLES", optional: false },
                { code: "RVC_SAFETY_BOXES", optional: false },
                { code: "RVC_AEB", optional: false },
                { code: "RVC_AEFI", optional: false },
            ],
            ageGroups: [
                [["6 - 8 m"]],
                [["9 - 11 m"]],
                [["12 - 59 m"], ["12 - 23 m", "24 - 59 m"]],
                [["5 - 14 y"], ["5 - 9 y", "5 - 12 y"]],
            ],
        },
        {
            name: "Meningitis Polysaccharide",
            code: "RVC_MENPOLY",
            dataElements: [
                { code: "RVC_DOSES_ADMINISTERED", optional: false },
                { code: "RVC_DOSES_USED", optional: false },
                { code: "RVC_ADS_USED", optional: false },
                { code: "RVC_SYRINGES", optional: false },
                { code: "RVC_NEEDLES", optional: false },
                { code: "RVC_SAFETY_BOXES", optional: false },
                { code: "RVC_AEB", optional: false },
                { code: "RVC_AEFI", optional: false },
            ],
            ageGroups: [[["2 - 4 y"]], [["5 - 14 y"]], [["15 - 29 y"]]],
        },
        {
            name: "Meningitis Conjugate",
            code: "RVC_MENCONJ",
            dataElements: [
                { code: "RVC_DOSES_ADMINISTERED", optional: false },
                { code: "RVC_DOSES_USED", optional: false },
                { code: "RVC_ADS_USED", optional: true },
                { code: "RVC_SYRINGES", optional: true },
                { code: "RVC_NEEDLES", optional: true },
                { code: "RVC_SAFETY_BOXES", optional: true },
                { code: "RVC_AEB", optional: true },
                { code: "RVC_AEFI", optional: true },
            ],
            ageGroups: [[["12 - 59 m"]], [["5 - 14 y"]], [["15 - 29 y", "15 - 19 y"]]],
        },
        {
            name: "Cholera",
            code: "RVC_CHOLERA",
            dataElements: [
                { code: "RVC_DOSES_ADMINISTERED", optional: false },
                { code: "RVC_DOSES_USED", optional: false },
                { code: "RVC_AEFI", optional: false },
            ],
            ageGroups: [[["12 - 59 m"]], [["5 - 14 y"]], [["15 - 99 y"], ["15 - 29 y", "> 30 y"]]],
        },
        {
            name: "PCV",
            code: "RVC_PCV",
            dataElements: [
                { code: "RVC_DOSES_ADMINISTERED", optional: false },
                { code: "RVC_DOSES_USED", optional: false },
                { code: "RVC_ADS_USED", optional: false },
                { code: "RVC_SAFETY_BOXES", optional: false },
                { code: "RVC_AEB", optional: false },
                { code: "RVC_AEFI", optional: false },
            ],
            ageGroups: [
                [["6 w - 11 m"]],
                [["12 - 23 m"]],
                [["24 - 59 m"]],
                [["5 - 14 y"], ["5 - 7 y", "8 - 14 y"]],
            ],
        },
        {
            name: "Pertussis Penta",
            code: "RVC_PERTPENTA",
            dataElements: [
                { code: "RVC_DOSES_ADMINISTERED", optional: false },
                { code: "RVC_DOSES_USED", optional: false },
                { code: "RVC_ADS_USED", optional: false },
                { code: "RVC_SAFETY_BOXES", optional: false },
                { code: "RVC_AEB", optional: false },
                { code: "RVC_AEFI", optional: false },
            ],
            ageGroups: [
                [["6 w - 11 m"]],
                [["12 - 23 m"]],
                [["24 - 59 m"]],
                [["5 - 14 y"], ["5 - 7 y", "8 - 14 y"]],
            ],
        },
        {
            name: "Yellow Fever",
            code: "RVC_YELLOW_FEVER",
            dataElements: [
                { code: "RVC_DOSES_ADMINISTERED", optional: false },
                { code: "RVC_DOSES_USED", optional: false },
                { code: "RVC_ADS_USED", optional: false },
                { code: "RVC_SYRINGES", optional: false },
                { code: "RVC_NEEDLES", optional: false },
                { code: "RVC_SAFETY_BOXES", optional: false },
                { code: "RVC_AEB", optional: false },
                { code: "RVC_AEFI", optional: false },
            ],
            ageGroups: [
                [
                    ["9 - 59 m"],
                    ["9 - 11 m", "12 - 23 m", "25 - 59 m"],
                    ["12 - 59 m"],
                    ["12 - 23 m", "25 - 59 m"],
                ],
                [["12 - 23 m"]],
                [["5 - 14 y"]],
                [["15 - 99 y"], ["15 - 29 y", ">30 y"]],
            ],
        },
        {
            name: "Japanese Encephalitis",
            code: "RVC_JPENC",
            dataElements: [
                { code: "RVC_DOSES_ADMINISTERED", optional: false },
                { code: "RVC_DOSES_USED", optional: false },
                { code: "RVC_ADS_USED", optional: false },
                { code: "RVC_SYRINGES", optional: true },
                { code: "RVC_NEEDLES", optional: true },
                { code: "RVC_SAFETY_BOXES", optional: false },
                { code: "RVC_AEB", optional: false },
                { code: "RVC_AEFI", optional: false },
            ],
            ageGroups: [
                [["8 - 11 m"], ["9 - 11 m"], ["6 - 11 m"]],
                [["12 - 59 m"]],
                [["5 - 14 y"]],
                [["15 - 29 y"]],
            ],
        },
        {
            name: "Dengue",
            code: "RVC_DENGUE",
            dataElements: [
                { code: "RVC_DOSES_ADMINISTERED", optional: false },
                { code: "RVC_DOSES_USED", optional: false },
                { code: "RVC_ADS_USED", optional: false },
                { code: "RVC_SYRINGES", optional: true },
                { code: "RVC_NEEDLES", optional: true },
                { code: "RVC_SAFETY_BOXES", optional: false },
                { code: "RVC_AEB", optional: false },
                { code: "RVC_AEFI", optional: false },
            ],
            ageGroups: [[["9 - 14 y"]], [["15 - 29 y"]]],
        },
        {
            name: "Typhoid Fever",
            code: "RVC_TYPHOID_FEVER",
            dataElements: [
                { code: "RVC_DOSES_ADMINISTERED", optional: false },
                { code: "RVC_DOSES_USED", optional: false },
                { code: "RVC_ADS_USED", optional: false },
                { code: "RVC_SYRINGES", optional: true },
                { code: "RVC_NEEDLES", optional: true },
                { code: "RVC_SAFETY_BOXES", optional: false },
                { code: "RVC_AEB", optional: false },
                { code: "RVC_AEFI", optional: false },
            ],
            ageGroups: [
                [["6 - 11 m"]],
                [["12 - 59 m"]],
                [["5 - 14 y"]],
                [["15 - 45 y"], ["15 - 29 y", "30 - 45 y"]],
            ],
        },
    ],
};

export async function getMetadataConfig(db: DbD2): Promise<MetadataConfig> {
    const metadata = await db.getMetadata<{ categories: Category[] }>({
        categories: {
            filters: ["code:startsWith:RVC_"],
            fields: {
                name: true,
                code: true,
                dataDimensionType: true,
                dataDimension: true,
                categoryOptions: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    const categories: MetadataConfig["categories"] = metadata.categories.map(category => {
        let $categoryOptions: MetadataConfig["categories"][0]["$categoryOptions"];
        if (category.code === "RVC_ANTIGENS") {
            $categoryOptions = { kind: "fromAntigens" };
        } else if (category.code === "RVC_AGE_GROUP") {
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

    return {
        ...metadataConfigBase,
        categories,
    };
}
