import _ from "lodash";
import { generateUid } from "d2/uid";

export const dashboardItemsConfig = {
    antigenCategoryCode: "RVC_ANTIGEN",
    tables: {
        vaccines: {
            elements: ["RVC_DOSES_ADMINISTERED"],
            dataType: "DATA_ELEMENT",
            appendCode: "vTable",
            disaggregatedBy: ["team", "ageGroup", "doses"],
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
            disaggregatedBy: ["team"],
        },
        indicators: {
            elements: ["RVC_SAFETY_BOXES", "RVC_ADS_WASTAGE", "RVC_DILUTION_SYRINGES_RATIO"],
            dataType: "INDICATOR",
            appendCode: "indicatorsTable",
        },
        campaignCoverage: {
            elements: ["RVC_CAMPAIGN_COVERAGE"],
            dataType: "INDICATOR",
            appendCode: "campaignCoverageTable",
        },
    },
    charts: {
        utilizationRate: {
            elements: ["RVC_VACCINE_UTILIZATION"],
            dataType: "INDICATOR",
            appendCode: "utilizationRateChart",
            type: "LINE",
            disaggregatedBy: ["team"],
        },
        indicators: {
            elements: ["RVC_SAFETY_BOXES", "RVC_ADS_WASTAGE", "RVC_DILUTION_SYRINGES_RATIO"],
            dataType: "INDICATOR",
            appendCode: "indicatorsChart",
            type: "COLUMN",
        },
        campaignCoverage: {
            elements: ["RVC_CAMPAIGN_COVERAGE"],
            dataType: "INDICATOR",
            appendCode: "campaignCoverageChart",
            type: "LINE",
        },
    },
    globalTables: {
        globalQsIndicators: {
            elements: ["RVC_ADS_USED", "RVC_SAFETY_BOXES"],
            dataType: "DATA_ELEMENT",
            appendCode: "globalQsTable",
            disaggregatedBy: ["team"],
        },
    },
};

export function buildDashboardItemsCode(datasetName, orgUnitName, antigenName, appendCode) {
    return [datasetName, orgUnitName, antigenName, appendCode].join("_");
}

function getDisaggregations(itemConfigs, disaggregationMetadata, antigen) {
    if (!itemConfigs.disaggregatedBy) return [];

    const ageGroups = c =>
        c.disaggregatedBy.includes("ageGroup") && antigen
            ? disaggregationMetadata.ageGroups(antigen)
            : null;

    const teams = c => (c.disaggregatedBy.includes("team") ? disaggregationMetadata.teams() : null);

    const doses = c =>
        c.disaggregatedBy.includes("doses") ? disaggregationMetadata.doses(antigen) : null;

    return _.compact([teams(itemConfigs), ageGroups(itemConfigs), doses(itemConfigs)]);
}

function getCharts(antigen, elements, organisationUnit, itemsMetadata, disaggregationMetadata) {
    return _(dashboardItemsConfig.charts)
        .map((chart, key) =>
            chartConstructor({
                id: generateUid(),
                antigen,
                data: elements[key],
                type: chart.type,
                appendCode: chart.appendCode,
                organisationUnit,
                ...itemsMetadata,
                disaggregations: getDisaggregations(chart, disaggregationMetadata, antigen),
            })
        )
        .value();
}

function getTables(
    antigen,
    elements,
    organisationUnit,
    itemsMetadata,
    disaggregationMetadata,
    { general = false } = {}
) {
    const tables = general ? dashboardItemsConfig.globalTables : dashboardItemsConfig.tables;
    return _(tables)
        .map((c, key) =>
            tableConstructor({
                id: generateUid(),
                antigen,
                data: elements[key],
                appendCode: c.appendCode,
                organisationUnit,
                ...itemsMetadata,
                disaggregations: getDisaggregations(c, disaggregationMetadata, antigen),
            })
        )
        .value();
}

export function buildDashboardItems(
    antigensMeta,
    datasetName,
    organisationUnitsMetadata,
    period,
    antigenCategory,
    disaggregationMetadata,
    elements
) {
    const itemsMetadata = {
        datasetName,
        period,
        antigenCategory,
    };

    const charts = _(antigensMeta)
        .flatMap(antigen =>
            organisationUnitsMetadata.map(ou =>
                getCharts(antigen, elements, ou, itemsMetadata, disaggregationMetadata)
            )
        )
        .value();
    const tables = _(antigensMeta)
        .flatMap(antigen =>
            organisationUnitsMetadata.map(ou =>
                getTables(antigen, elements, ou, itemsMetadata, disaggregationMetadata)
            )
        )
        .value();

    const globalTables = organisationUnitsMetadata.map(ou =>
        getTables(null, elements, ou, itemsMetadata, disaggregationMetadata, { general: true })
    );

    const reportTables = _.flatten(tables).concat(...globalTables);
    return { charts: _.flatten(charts), reportTables };
}

const dataMapper = (dataList, filterList) =>
    dataList.data
        .filter(({ code }) => _.includes(filterList, code))
        .map(({ id }) => ({
            dataDimensionItemType: dataList.type,
            [dataList.key]: { id },
        }));

export function itemsMetadataConstructor(dashboardItemsMetadata) {
    const {
        dataElements,
        indicators,
        antigenCategory,
        disaggregationMetadata,
    } = dashboardItemsMetadata;
    const { tables, charts, globalTables } = dashboardItemsConfig;

    const allTables = { ...tables, ...globalTables };
    const tableElements = _(allTables)
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
        disaggregationMetadata,
        ...tableElements,
        ...chartElements,
    };
    return dashboardItemsElements;
}

function getDimensions(disaggregations, antigen, antigenCategory) {
    const antigenCategoryDimension = antigen
        ? {
              category: { id: antigenCategory },
              categoryOptions: [{ id: antigen.id }],
          }
        : {};

    const noDisaggregationDimension = {
        categoryDimensions: antigenCategoryDimension,
        columns: { id: "dx" },
        columnDimensions: "dx",
    };

    if (_.isEmpty(disaggregations)) return _.mapValues(noDisaggregationDimension, dis => [dis]);

    const disaggregationDimensions = disaggregations.map(d => ({
        categoryDimensions: {
            category: {
                id: d.categoryId,
            },
            categoryOptions: d.elements.map(e => ({ id: e })),
        },
        columns: { id: d.categoryId },
        columnDimensions: d.categoryId,
    }));

    const keys = ["categoryDimensions", "columns", "columnDimensions"];

    const allDimensions = [noDisaggregationDimension, ...disaggregationDimensions];

    return _(keys)
        .zip(keys.map(key => allDimensions.map(o => o[key])))
        .fromPairs()
        .value();
}

const chartConstructor = ({
    id,
    datasetName,
    antigen,
    period,
    antigenCategory,
    data,
    type,
    appendCode,
    organisationUnit,
    disaggregations,
}) => {
    const { categoryDimensions, columns: allColumns } = getDimensions(
        disaggregations,
        antigen,
        antigenCategory
    );

    const columns = _.isEmpty(disaggregations) ? allColumns : allColumns.filter(c => c.id !== "dx");

    const filterDimensions = _.compact([
        "ou",
        antigenCategory,
        _.isEmpty(disaggregations) ? null : "dx",
    ]);

    const series = _.isEmpty(disaggregations) ? "dx" : columns[0].id;

    return {
        id,
        name: buildDashboardItemsCode(datasetName, organisationUnit.name, antigen.name, appendCode),
        showData: true,
        publicAccess: "rw------",
        userOrganisationUnitChildren: false,
        type,
        subscribed: false,
        parentGraphMap: organisationUnit.parents,
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
        displayName: buildDashboardItemsCode(
            datasetName,
            organisationUnit.name,
            antigen.name,
            appendCode
        ),
        hideSubtitle: false,
        hideLegend: false,
        externalAccess: false,
        percentStackedValues: false,
        noSpaceBetweenColumns: false,
        hideTitle: false,
        series,
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
        filterDimensions,
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
        columns,
        organisationUnitGroupSetDimensions: [],
        organisationUnitLevels: [],
        dataElementDimensions: [],
        periods: period,
        organisationUnits: [{ id: organisationUnit.id }],
        categoryDimensions,
        filters: [{ id: "ou" }, { id: antigenCategory }],
        rows: [{ id: "pe" }],
    };
};

const tableConstructor = ({
    id,
    datasetName,
    antigen,
    period,
    antigenCategory,
    data,
    appendCode,
    organisationUnit,
    disaggregations,
}) => {
    const { columns, columnDimensions, categoryDimensions } = getDimensions(
        disaggregations,
        antigen,
        antigenCategory
    );

    const subName = antigen ? antigen.name : "Global";

    return {
        id,
        name: buildDashboardItemsCode(datasetName, organisationUnit.name, subName, appendCode),
        numberType: "VALUE",
        publicAccess: "rw------",
        userOrganisationUnitChildren: false,
        legendDisplayStyle: "FILL",
        hideEmptyColumns: false,
        subscribed: false,
        hideEmptyRows: true,
        parentGraphMap: {},
        userOrganisationUnit: false,
        rowSubTotals: !_.isEmpty(disaggregations),
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
        displayName: buildDashboardItemsCode(
            datasetName,
            organisationUnit.name,
            subName,
            appendCode
        ),
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
        filterDimensions: _.compact(["ou", antigen ? antigenCategory : null]),
        interpretations: [],
        itemOrganisationUnitGroups: [],
        userGroupAccesses: [],
        programIndicatorDimensions: [],
        subscribers: [],
        attributeValues: [],
        columnDimensions,
        userAccesses: [],
        favorites: [],
        dataDimensionItems: data,
        categoryOptionGroupSetDimensions: [],
        columns,
        organisationUnitGroupSetDimensions: [],
        organisationUnitLevels: [],
        dataElementDimensions: [],
        periods: period,
        organisationUnits: [{ id: organisationUnit.id }],
        categoryDimensions,
        filters: [],
        rows: [],
        rowDimensions: ["pe"],
    };
};
