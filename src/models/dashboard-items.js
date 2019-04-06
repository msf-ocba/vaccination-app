import _ from "lodash";
import { generateUid } from "d2/uid";

export const dashboardItemsConfig = {
    categoryCode: "RVC_ANTIGEN",
    tables: {
        vaccines: {
            elements: ["RVC_DOSES_ADMINISTERED", "RVC_DOSES_USED"],
            dataType: "DATA_ELEMENT",
            appendCode: "vTable",
        },
        qsIndicators: {
            elements: [
                "RVC_ADS_USED",
                "RVC_SYRINGES",
                "RVC_SAFETY_BOXES",
                "RVC_NEEDLES",
                "RVC_AEB",
                "RVC_AEFI",
            ],
            dataType: "DATA_ELEMENT",
            appendCode: "qsTable",
        },
        indicator: {
            elements: ["RVC_SAFETY_BOXES", "RVC_ADS_WASTAGE", "RVC_DILUTION_SYRINGES_RATIO"],
            dataType: "INDICATOR",
            appendCode: "indicatorTable",
        },
    },
    charts: {
        utilizationRate: {
            elements: ["RVC_VACCINE_UTILIZATION"],
            dataType: "INDICATOR",
            appendCode: "utilizationRateChart",
            type: "LINE",
        },
        indicator: {
            elements: ["RVC_SAFETY_BOXES", "RVC_ADS_WASTAGE", "RVC_DILUTION_SYRINGES_RATIO"],
            dataType: "INDICATOR",
            appendCode: "indicatorChart",
            type: "COLUMN",
        },
    },
};

export function buildDashboardItemsCode(datasetId, antigenId, appendCode) {
    return [datasetId, antigenId, appendCode].join("_");
}

function getCharts(antigen, elements, itemsMetadata) {
    return _(dashboardItemsConfig.charts)
        .map((c, key) =>
            chartConstructor({
                id: generateUid(),
                antigen,
                data: elements[key],
                type: c.type,
                appendCode: c.appendCode,
                ...itemsMetadata,
            })
        )
        .value();
}

function getTables(antigen, elements, itemsMetadata) {
    return _(dashboardItemsConfig.tables)
        .map((c, key) =>
            tableConstructor({
                id: generateUid(),
                antigen,
                data: elements[key],
                appendCode: c.appendCode,
                ...itemsMetadata,
            })
        )
        .value();
}

export function buildDashboardItems(
    antigensMeta,
    datasetName,
    datasetId,
    organisationUnitsIds,
    organisationUnitsParents,
    period,
    antigenCategory,
    elements
) {
    const itemsMetadata = {
        datasetName,
        datasetId,
        organisationUnitsIds,
        organisationUnitsParents,
        period,
        antigenCategory,
    };

    const charts = antigensMeta.map(antigen => getCharts(antigen, elements, itemsMetadata));
    const tables = antigensMeta.map(antigen => getTables(antigen, elements, itemsMetadata));

    return { charts: _.flatten(charts), reportTables: _.flatten(tables) };
}

const dataMapper = (dataList, filterList) =>
    dataList.data
        .filter(({ code }) => _.includes(filterList, code))
        .map(({ id }) => ({
            dataDimensionItemType: dataList.type,
            [dataList.key]: { id },
        }));

export function itemsMetadataConstructor(dashboardItemsMetadata) {
    const { dataElements, indicators, antigenCategory } = dashboardItemsMetadata;
    const { tables, charts } = dashboardItemsConfig;

    const tableElements = _(tables)
        .map((item, key) =>
            item.dataType === "INDICATOR"
                ? [key, dataMapper(indicators, item.elements)]
                : [key, dataMapper(dataElements, item.elements)]
        )
        .fromPairs()
        .value();

    const chartElements = _(charts)
        .map((item, key) =>
            item.dataType === "INDICATOR"
                ? [key, dataMapper(indicators, item.elements)]
                : [key, dataMapper(dataElements, item.elements)]
        )
        .fromPairs()
        .value();

    const dashboardItemsElements = {
        antigenCategory,
        ...tableElements,
        ...chartElements,
    };
    return dashboardItemsElements;
}

const chartConstructor = ({
    id,
    datasetName,
    antigen,
    datasetId,
    organisationUnitsIds,
    organisationUnitsParents,
    period,
    antigenCategory,
    data,
    type,
    appendCode,
}) => ({
    id,
    name: [datasetName, antigen.name, appendCode].join("-"),
    code: buildDashboardItemsCode(datasetId, antigen.id, appendCode),
    showData: true,
    publicAccess: "rw------",
    userOrganisationUnitChildren: false,
    type,
    subscribed: false,
    parentGraphMap: organisationUnitsParents,
    userOrganisationUnit: false,
    regressionType: "NONE",
    completedOnly: false,
    cumulativeValues: false,
    sortOrder: 0,
    favorite: false,
    topLimit: 0,
    hideEmptyRowItems: "AFTER_LAST",
    aggregationType: "DEFAULT",
    userOrganisationUnitGrandChildren: false,
    displayName: [datasetName, antigen.name, appendCode].join("-"),
    hideSubtitle: false,
    hideLegend: false,
    externalAccess: false,
    percentStackedValues: false,
    noSpaceBetweenColumns: false,
    hideTitle: false,
    series: "dx",
    category: "pe",
    access: {
        read: true,
        update: true,
        externalize: true,
        delete: true,
        write: true,
        manage: true,
    },
    relativePeriods: {
        thisYear: false,
        quartersLastYear: false,
        last52Weeks: false,
        thisWeek: false,
        lastMonth: false,
        last14Days: false,
        biMonthsThisYear: false,
        monthsThisYear: false,
        last2SixMonths: false,
        yesterday: false,
        thisQuarter: false,
        last12Months: false,
        last5FinancialYears: false,
        thisSixMonth: false,
        lastQuarter: false,
        thisFinancialYear: false,
        last4Weeks: false,
        last3Months: false,
        thisDay: false,
        thisMonth: false,
        last5Years: false,
        last6BiMonths: false,
        last4BiWeeks: false,
        lastFinancialYear: false,
        lastBiWeek: false,
        weeksThisYear: false,
        last6Months: false,
        last3Days: false,
        quartersThisYear: false,
        monthsLastYear: false,
        lastWeek: false,
        last7Days: false,
        thisBimonth: false,
        lastBimonth: false,
        lastSixMonth: false,
        thisBiWeek: false,
        lastYear: false,
        last12Weeks: false,
        last4Quarters: false,
    },
    dataElementGroupSetDimensions: [],
    attributeDimensions: [],
    translations: [],
    filterDimensions: ["ou", antigenCategory],
    interpretations: [],
    itemOrganisationUnitGroups: [],
    userGroupAccesses: [],
    programIndicatorDimensions: [],
    subscribers: [],
    attributeValues: [],
    userAccesses: [],
    favorites: [],
    dataDimensionItems: data,
    categoryOptionGroupSetDimensions: [],
    columns: [{ id: "dx" }],
    organisationUnitGroupSetDimensions: [],
    organisationUnitLevels: [],
    dataElementDimensions: [],
    periods: period,
    organisationUnits: organisationUnitsIds,
    categoryDimensions: [
        { category: { id: antigenCategory }, categoryOptions: [{ id: antigen.id }] },
    ],
    filters: [{ id: "ou" }, { id: antigenCategory }],
    rows: [{ id: "pe" }],
});

const tableConstructor = ({
    id,
    datasetName,
    antigen,
    datasetId,
    organisationUnitsIds,
    period,
    antigenCategory,
    data,
    appendCode,
}) => ({
    id,
    name: [datasetName, antigen.name, appendCode].join("-"),
    code: buildDashboardItemsCode(datasetId, antigen.id, appendCode),
    numberType: "VALUE",
    publicAccess: "rw------",
    userOrganisationUnitChildren: false,
    legendDisplayStyle: "FILL",
    hideEmptyColumns: false,
    subscribed: false,
    hideEmptyRows: true,
    parentGraphMap: {},
    userOrganisationUnit: false,
    rowSubTotals: false,
    displayDensity: "NORMAL",
    completedOnly: false,
    colTotals: true,
    showDimensionLabels: true,
    sortOrder: 0,
    fontSize: "NORMAL",
    favorite: false,
    topLimit: 0,
    aggregationType: "DEFAULT",
    userOrganisationUnitGrandChildren: false,
    displayName: [datasetName, antigen.name, appendCode].join("-"),
    hideSubtitle: false,
    externalAccess: false,
    legendDisplayStrategy: "FIXED",
    colSubTotals: false,
    showHierarchy: false,
    rowTotals: false,
    cumulative: false,
    digitGroupSeparator: "NONE",
    hideTitle: false,
    regression: false,
    skipRounding: false,
    reportParams: {
        paramGrandParentOrganisationUnit: false,
        paramReportingPeriod: false,
        paramOrganisationUnit: false,
        paramParentOrganisationUnit: false,
    },
    access: {
        read: true,
        update: true,
        externalize: true,
        delete: true,
        write: true,
        manage: true,
    },
    relativePeriods: {
        thisYear: false,
        quartersLastYear: false,
        last52Weeks: false,
        thisWeek: false,
        lastMonth: false,
        last14Days: false,
        biMonthsThisYear: false,
        monthsThisYear: false,
        last2SixMonths: false,
        yesterday: false,
        thisQuarter: false,
        last12Months: false,
        last5FinancialYears: false,
        thisSixMonth: false,
        lastQuarter: false,
        thisFinancialYear: false,
        last4Weeks: false,
        last3Months: false,
        thisDay: false,
        thisMonth: false,
        last5Years: false,
        last6BiMonths: false,
        last4BiWeeks: false,
        lastFinancialYear: false,
        lastBiWeek: false,
        weeksThisYear: false,
        last6Months: false,
        last3Days: false,
        quartersThisYear: false,
        monthsLastYear: false,
        lastWeek: false,
        last7Days: false,
        thisBimonth: false,
        lastBimonth: false,
        lastSixMonth: false,
        thisBiWeek: false,
        lastYear: false,
        last12Weeks: false,
        last4Quarters: false,
    },
    dataElementGroupSetDimensions: [],
    attributeDimensions: [],
    translations: [],
    filterDimensions: ["ou", antigenCategory],
    interpretations: [],
    itemOrganisationUnitGroups: [],
    userGroupAccesses: [],
    programIndicatorDimensions: [],
    subscribers: [],
    attributeValues: [],
    columnDimensions: ["dx"],
    userAccesses: [],
    favorites: [],
    dataDimensionItems: data,
    categoryOptionGroupSetDimensions: [],
    columns: [],
    organisationUnitGroupSetDimensions: [],
    organisationUnitLevels: [],
    dataElementDimensions: [],
    periods: period,
    organisationUnits: organisationUnitsIds,
    categoryDimensions: [
        { category: { id: antigenCategory }, categoryOptions: [{ id: antigen.id }] },
    ],
    filters: [],
    rows: [],
    rowDimensions: ["pe"],
});
