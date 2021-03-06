import { MetadataConfig, baseConfig } from "../config";

const metadataConfig: MetadataConfig = {
    ...baseConfig,
    userRoles: [],
    organisationUnitLevels: [],
    categoryCombos: [],
    categoryOptions: [],
    legendSets: [],
    indicators: [],
    defaults: {
        categoryOptionCombo: {
            displayName: "default",
            id: "12345",
            categoryOptions: [],
            categoryCombo: { id: "default" },
        },
    },
    attributes: {
        app: {
            code: "RVC_CREATED_BY_VACCINATION_APP",
            id: "1",
            displayName: "Created by app",
            valueType: "BOOLEAN",
        },
        hideInTallySheet: {
            id: "2",
            code: "",
            displayName: "hideInTallySheet",
            valueType: "BOOLEAN",
        },
    },
    categories: [],
    categoriesDisaggregation: [
        {
            name: "Antigens",
            code: "RVC_ANTIGENS",
            dataDimensionType: "DISAGGREGATION",
            dataDimension: false,
            $categoryOptions: { kind: "fromAntigens" },
        },
        {
            name: "Age group",
            code: "RVC_AGE_GROUP",
            dataDimensionType: "DISAGGREGATION",
            dataDimension: true,
            $categoryOptions: { kind: "fromAgeGroups" },
        },
        {
            name: "Teams",
            code: "RVC_TEAMS",
            dataDimensionType: "ATTRIBUTE",
            dataDimension: true,
            $categoryOptions: {
                kind: "values",
                values: ["Team 1", "Team 2", "Team 3", "Team 4", "Team 5"],
            },
        },
        {
            name: "Gender",
            code: "RVC_GENDER",
            dataDimensionType: "DISAGGREGATION",
            dataDimension: true,
            $categoryOptions: { kind: "values", values: ["Female", "Male"] },
        },
        {
            name: "Severity",
            code: "RVC_SEVERITY",
            dataDimensionType: "DISAGGREGATION",
            dataDimension: true,
            $categoryOptions: { kind: "values", values: ["Minor", "Severe"] },
        },
        {
            name: "Displacement Status",
            code: "RVC_DISPLACEMENT_STATUS",
            dataDimensionType: "DISAGGREGATION",
            dataDimension: true,
            $categoryOptions: { kind: "values", values: ["Host", "IDP", "Refugees"] },
        },
        {
            name: "Demographic age distribution",
            code: "RVC_DEMOGRAPHIC_AGE",
            dataDimensionType: "DISAGGREGATION",
            dataDimension: false,
            $categoryOptions: { kind: "values", values: [] },
        },
    ],
    population: {
        totalPopulationDataElement: {
            id: "1",
            code: "CODE",
            displayName: "Total population",
            categoryCombo: { id: "1" },
            formName: "",
        },
        ageDistributionDataElement: {
            id: "2",
            code: "CODE",
            displayName: "Age distribution (%)",
            categoryCombo: { id: "1" },
            formName: "",
        },
        populationByAgeDataElement: {
            id: "3",
            code: "CODE",
            displayName: "Population By age",
            categoryCombo: { id: "1" },
            formName: "",
        },
        ageGroupCategory: {
            id: "1",
            code: "RVC_AGE_GROUP",
            displayName: "Age Group",
            categoryOptions: [],
            dataDimensionType: "DISAGGREGATION",
            dataDimension: true,
        },
        dataElementGroup: {
            code: "RVC_POPULATION",
            id: "mqamM2sRSrR",
            displayName: "RVC - Population",
            dataElements: [],
        },
    },
    dataElements: [
        {
            id: "1",
            displayName: "Vaccine doses administered",
            formName: "Vaccine doses administered - 1",
            code: "RVC_DOSES_ADMINISTERED",
            categoryCombo: { id: "1" },
        },
        {
            id: "2",
            displayName: "Vaccine doses used",
            formName: "Vaccine doses used - 2",
            code: "RVC_USED",
            categoryCombo: { id: "1" },
        },
        {
            id: "3",
            displayName: "ADS used",
            formName: "ADS used - 3",
            code: "RVC_ADS_USED",
            categoryCombo: { id: "1" },
        },
        {
            id: "4",
            displayName: "Syringes for dilution",
            formName: "Syringes for dilution - 5",
            code: "RVC_SYRINGES",
            categoryCombo: { id: "1" },
        },
        {
            id: "5",
            displayName: "Needles for dilution",
            formName: "Needles for dilution - 4",
            code: "RVC_NEEDLES",
            categoryCombo: { id: "1" },
        },
        {
            id: "6",
            displayName: "Safety boxes",
            code: "RVC_SAFETY_BOXES",
            formName: "Safety boxes - 6",
            categoryCombo: { id: "1" },
        },
        {
            id: "7",
            displayName: "Accidental Exposure to Blood (AEB)",
            formName: "Accidental Exposure to Blood (AEB) - 8",
            code: "RVC_AEB",
            categoryCombo: { id: "1" },
        },
        {
            id: "8",
            displayName: "Adverse Event Following Immunization",
            formName: "Adverse Event Following Immunization - 7",
            code: "RVC_AEFI",
            categoryCombo: { id: "1" },
        },
    ],
    dataElementsDisaggregation: [
        {
            id: "1",
            name: "Vaccine doses administered",
            code: "RVC_DOSES_ADMINISTERED",
            categories: [
                { code: "RVC_AGE_GROUP", optional: false },
                { code: "RVC_GENDER", optional: true },
                { code: "RVC_DISPLACEMENT_STATUS", optional: true },
            ],
        },
        {
            id: "2",
            name: "Vaccine doses used",
            code: "RVC_USED",
            categories: [],
        },
        {
            id: "3",
            name: "ADS used",
            code: "RVC_ADS_USED",
            categories: [],
        },
        {
            id: "4",
            name: "Syringes for dilution",
            code: "RVC_SYRINGES",
            categories: [],
        },
        {
            id: "5",
            name: "Needles doses used",
            code: "RVC_NEEDLES",
            categories: [],
        },
        {
            id: "6",
            name: "Safety boxes",
            code: "RVC_SAFETY_BOXES",
            categories: [],
        },
        {
            id: "7",
            name: "Accidental Exposure to Blood (AEB)",
            code: "RVC_AEB",
            categories: [],
        },
        {
            id: "8",
            name: "Adverse Event Following Immunization",
            code: "RVC_AEFI",
            categories: [{ code: "RVC_SEVERITY", optional: true }],
        },
    ],
    antigens: [
        {
            id: "1",
            name: "Measles",
            code: "RVC_MEASLES",
            doses: [],
            dataElements: [
                { id: "1", code: "RVC_DOSES_ADMINISTERED", optional: false, order: 1 },
                { id: "2", code: "RVC_DOSES_USED", optional: false, order: 1 },
                { id: "3", code: "RVC_ADS_USED", optional: true, order: 1 },
                { id: "4", code: "RVC_SYRINGES", optional: false, order: 1 },
                { id: "5", code: "RVC_NEEDLES", optional: false, order: 1 },
                { id: "6", code: "RVC_SAFETY_BOXES", optional: false, order: 1 },
                { id: "7", code: "RVC_AEB", optional: false, order: 1 },
                { id: "8", code: "RVC_AEFI", optional: false, order: 1 },
            ],
            ageGroups: [
                [["6 - 8 m"]],
                [["9 - 11 m"]],
                [["12 - 59 m"], ["12 - 23 m", "24 - 59 m"]],
                [["5 - 14 y"], ["5 - 9 y", "5 - 12 y"]],
            ],
        },
        {
            id: "2",
            name: "Meningitis Polysaccharide",
            code: "RVC_MENPOLY",
            doses: [],
            dataElements: [
                { id: "1", code: "RVC_DOSES_ADMINISTERED", optional: false, order: 1 },
                { id: "2", code: "RVC_DOSES_USED", optional: false, order: 1 },
                { id: "3", code: "RVC_ADS_USED", optional: false, order: 1 },
                { id: "4", code: "RVC_SYRINGES", optional: false, order: 1 },
                { id: "5", code: "RVC_NEEDLES", optional: false, order: 1 },
                { id: "6", code: "RVC_SAFETY_BOXES", optional: false, order: 1 },
                { id: "7", code: "RVC_AEB", optional: false, order: 1 },
                { id: "8", code: "RVC_AEFI", optional: false, order: 1 },
            ],
            ageGroups: [[["2 - 4 y"]], [["5 - 14 y"]], [["15 - 29 y"]]],
        },
        {
            id: "3",
            name: "Meningitis Conjugate",
            code: "RVC_MENCONJ",
            doses: [],
            dataElements: [
                { id: "1", code: "RVC_DOSES_ADMINISTERED", optional: false, order: 1 },
                { id: "2", code: "RVC_DOSES_USED", optional: false, order: 1 },
                { id: "3", code: "RVC_ADS_USED", optional: true, order: 1 },
                { id: "4", code: "RVC_SYRINGES", optional: true, order: 1 },
                { id: "5", code: "RVC_NEEDLES", optional: true, order: 1 },
                { id: "6", code: "RVC_SAFETY_BOXES", optional: true, order: 1 },
                { id: "7", code: "RVC_AEB", optional: true, order: 1 },
                { id: "8", code: "RVC_AEFI", optional: true, order: 1 },
            ],
            ageGroups: [[["12 - 59 m"]], [["5 - 14 y"]], [["15 - 29 y", "15 - 19 y"]]],
        },
        {
            id: "4",
            name: "Cholera",
            code: "RVC_CHOLERA",
            doses: [],
            dataElements: [
                { id: "1", code: "RVC_DOSES_ADMINISTERED", optional: false, order: 1 },
                { id: "2", code: "RVC_DOSES_USED", optional: false, order: 1 },
                { id: "8", code: "RVC_AEFI", optional: false, order: 1 },
            ],
            ageGroups: [[["12 - 59 m"]], [["5 - 14 y"]], [["15 - 99 y"], ["15 - 29 y", "> 30 y"]]],
        },
        {
            id: "5",
            name: "PCV",
            code: "RVC_PCV",
            doses: [],
            dataElements: [
                { id: "1", code: "RVC_DOSES_ADMINISTERED", optional: false, order: 1 },
                { id: "2", code: "RVC_DOSES_USED", optional: false, order: 1 },
                { id: "3", code: "RVC_ADS_USED", optional: false, order: 1 },
                { id: "6", code: "RVC_SAFETY_BOXES", optional: false, order: 1 },
                { id: "7", code: "RVC_AEB", optional: false, order: 1 },
                { id: "8", code: "RVC_AEFI", optional: false, order: 1 },
            ],
            ageGroups: [
                [["6 w - 11 m"]],
                [["12 - 23 m"]],
                [["24 - 59 m"]],
                [["5 - 14 y"], ["5 - 7 y", "8 - 14 y"]],
            ],
        },
        {
            id: "6",
            name: "Pertussis Penta",
            code: "RVC_PERTPENTA",
            doses: [],
            dataElements: [
                { id: "1", code: "RVC_DOSES_ADMINISTERED", optional: false, order: 1 },
                { id: "2", code: "RVC_DOSES_USED", optional: false, order: 1 },
                { id: "3", code: "RVC_ADS_USED", optional: false, order: 1 },
                { id: "6", code: "RVC_SAFETY_BOXES", optional: false, order: 1 },
                { id: "7", code: "RVC_AEB", optional: false, order: 1 },
                { id: "8", code: "RVC_AEFI", optional: false, order: 1 },
            ],
            ageGroups: [
                [["6 w - 11 m"]],
                [["12 - 23 m"]],
                [["24 - 59 m"]],
                [["5 - 14 y"], ["5 - 7 y", "8 - 14 y"]],
            ],
        },
        {
            id: "7",
            name: "Yellow Fever",
            code: "RVC_YELLOW_FEVER",
            doses: [],
            dataElements: [
                { id: "1", code: "RVC_DOSES_ADMINISTERED", optional: false, order: 1 },
                { id: "2", code: "RVC_DOSES_USED", optional: false, order: 1 },
                { id: "3", code: "RVC_ADS_USED", optional: false, order: 1 },
                { id: "4", code: "RVC_SYRINGES", optional: false, order: 1 },
                { id: "5", code: "RVC_NEEDLES", optional: false, order: 1 },
                { id: "6", code: "RVC_SAFETY_BOXES", optional: false, order: 1 },
                { id: "7", code: "RVC_AEB", optional: false, order: 1 },
                { id: "8", code: "RVC_AEFI", optional: false, order: 1 },
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
            id: "8",
            name: "Japanese Encephalitis",
            code: "RVC_JPENC",
            doses: [],
            dataElements: [
                { id: "1", code: "RVC_DOSES_ADMINISTERED", optional: false, order: 1 },
                { id: "2", code: "RVC_DOSES_USED", optional: false, order: 1 },
                { id: "3", code: "RVC_ADS_USED", optional: false, order: 1 },
                { id: "4", code: "RVC_SYRINGES", optional: true, order: 1 },
                { id: "5", code: "RVC_NEEDLES", optional: true, order: 1 },
                { id: "6", code: "RVC_SAFETY_BOXES", optional: false, order: 1 },
                { id: "7", code: "RVC_AEB", optional: false, order: 1 },
                { id: "8", code: "RVC_AEFI", optional: false, order: 1 },
            ],
            ageGroups: [
                [["8 - 11 m"], ["9 - 11 m"], ["6 - 11 m"]],
                [["12 - 59 m"]],
                [["5 - 14 y"]],
                [["15 - 29 y"]],
            ],
        },
        {
            id: "9",
            name: "Dengue",
            code: "RVC_DENGUE",
            doses: [],
            dataElements: [
                { id: "1", code: "RVC_DOSES_ADMINISTERED", optional: false, order: 1 },
                { id: "2", code: "RVC_DOSES_USED", optional: false, order: 1 },
                { id: "3", code: "RVC_ADS_USED", optional: false, order: 1 },
                { id: "4", code: "RVC_SYRINGES", optional: true, order: 1 },
                { id: "5", code: "RVC_NEEDLES", optional: true, order: 1 },
                { id: "6", code: "RVC_SAFETY_BOXES", optional: false, order: 1 },
                { id: "7", code: "RVC_AEB", optional: false, order: 1 },
                { id: "8", code: "RVC_AEFI", optional: false, order: 1 },
            ],
            ageGroups: [[["9 - 14 y"]], [["15 - 29 y"]]],
        },
        {
            id: "10",
            name: "Typhoid Fever",
            code: "RVC_TYPHOID_FEVER",
            doses: [],
            dataElements: [
                { id: "1", code: "RVC_DOSES_ADMINISTERED", optional: false, order: 1 },
                { id: "2", code: "RVC_DOSES_USED", optional: false, order: 1 },
                { id: "3", code: "RVC_ADS_USED", optional: false, order: 1 },
                { id: "4", code: "RVC_SYRINGES", optional: true, order: 1 },
                { id: "5", code: "RVC_NEEDLES", optional: true, order: 1 },
                { id: "6", code: "RVC_SAFETY_BOXES", optional: false, order: 1 },
                { id: "7", code: "RVC_AEB", optional: false, order: 1 },
                { id: "8", code: "RVC_AEFI", optional: false, order: 1 },
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

export default metadataConfig;
