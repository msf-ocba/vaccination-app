import _ from "lodash";
import { generateUid } from "d2/uid";

/*
tables: {
    elements: [
        { code: 'RVC_DOSES_ADMINISTERED', dataType: 'DATA_ELEMENT' },
    ],
    rows: ["ou"],
    filter: ["pe"],
    appendCode: "globalQsTable",
    disaggregatedBy: [],
}

*/

export const dashboardItemsConfig = {
    metadataToFetch: {
        INDICATOR: [
            "RVC_ADS_WASTAGE",
            "RVC_DILUTION_SYRINGES_RATIO",
            "RVC_SAFETY_BOXES",
            "RVC_CAMPAIGN_COVERAGE",
            "RVC_VACCINE_UTILIZATION",
            "RVC_CAMPAIGN_NEEDLES_RATIO",
        ],
        DATA_ELEMENT: ["RVC_AEB", "RVC_AEFI", "RVC_DOSES_ADMINISTERED", "RVC_DOSES_USED"],
    },
    /*
    charts: {
        campaignCoverage: {
            elements: ["RVC_CAMPAIGN_COVERAGE"],
            dataType: "INDICATOR",
            appendCode: "campaignCoverageChart",
            type: "LINE",
        },
    }, */
    tables: {
        qsPerAntigen: {
            elements: ["RVC_DILUTION_SYRINGES_RATIO", "RVC_CAMPAIGN_NEEDLES_RATIO"],
            rows: ["pe", "teams"],
            filterDataBy: ["ou"],
            area: false,
            disaggregatedBy: [],
            title: "QS Indicators",
            appendCode: "qsIndicatorsTable",
        },
        vaccinesPerArea: {
            elements: ["RVC_DOSES_ADMINISTERED", "RVC_DOSES_USED", "RVC_VACCINE_UTILIZATION"],
            rows: ["ou"],
            area: true,
            filterDataBy: ["pe"],
            appendCode: "vaccinesPerArea",
            title: "Vaccines Per Area",
            disaggregatedBy: [],
        },
        vaccinesPerDateTeam: {
            elements: ["RVC_DOSES_ADMINISTERED", "RVC_DOSES_USED", "RVC_VACCINE_UTILIZATION"],
            rows: ["pe", "teams"],
            area: false,
            filterDataBy: ["ou"],
            appendCode: "vaccinesPerDateTeam",
            title: "Vaccines Per Team",
            disaggregatedBy: [],
        },
    },
    globalTables: {
        globalQsIndicators: {
            elements: [
                "RVC_ADS_WASTAGE",
                "RVC_DILUTION_SYRINGES_RATIO",
                "RVC_SAFETY_BOXES",
                "RVC_CAMPAIGN_NEEDLES_RATIO",
            ],
            rows: ["ou"],
            filterDataBy: ["pe"],
            appendCode: "globalQsTable",
            disaggregatedBy: [],
            area: true,
            title: "Global QS Indicators",
        },
        aefiAEB: {
            elements: ["RVC_AEB", "RVC_AEFI"],
            rows: ["pe"],
            filterDataBy: ["ou"],
            appendCode: "adverseEvents",
            disaggregatedBy: [],
            area: false,
            legendCode: "RVC_LEGEND_ZERO",
            title: "AEFI and AEB indicators",
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
/*
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
*/
function getTables({
    antigen,
    elements,
    organisationUnits,
    itemsMetadata,
    disaggregationMetadata,
    general = false,
    legendsMetadata,
}) {
    const tables = general ? dashboardItemsConfig.globalTables : dashboardItemsConfig.tables;

    return _(tables)
        .map((c, key) => {
            const teamMetadata = disaggregationMetadata.teams();
            const rows = c.rows.map(row => (row === "teams" ? teamMetadata.categoryId : row));
            const teamRowRawDimension = _.some(c.rows, r => r === "teams") ? teamMetadata : null;

            const legendId = c.legendCode ? legendsMetadata.get(c.legendCode) : null;
            return tableConstructor({
                id: generateUid(),
                antigen,
                data: elements[key],
                appendCode: c.appendCode,
                rows,
                filterDataBy: c.filterDataBy,
                organisationUnits,
                title: c.title,
                area: c.area || false,
                legendId,
                teamRowRawDimension,
                ...itemsMetadata,
                disaggregations: getDisaggregations(c, disaggregationMetadata, antigen),
            });
        })
        .value();
}

export function buildDashboardItems(
    antigensMeta,
    datasetName,
    organisationUnitsMetadata,
    period,
    antigenCategory,
    disaggregationMetadata,
    elements,
    legendsMetadata
) {
    const itemsMetadata = {
        datasetName,
        period,
        antigenCategory,
    };
    /*
    const charts = _(antigensMeta)
        .flatMap(antigen =>
            organisationUnitsMetadata.map(ou =>
                getCharts(antigen, elements, ou, itemsMetadata, disaggregationMetadata)
            )
        )
        .value();
    */

    const tables = _(antigensMeta)
        .map(antigen =>
            getTables({
                antigen,
                elements,
                organisationUnits: organisationUnitsMetadata,
                itemsMetadata,
                disaggregationMetadata,
                legendsMetadata,
            })
        )
        .flatten()
        .value();
    const globalTables = getTables({
        antigen: null,
        elements,
        organisationUnits: organisationUnitsMetadata,
        itemsMetadata,
        disaggregationMetadata,
        legendsMetadata,
        general: true,
    });

    const reportTables = [...tables, ...globalTables];

    //return { charts: _.flatten(charts), reportTables };
    return { charts: _.flatten([]), reportTables };
}

const dataMapper = (elementsMetadata, filterList) =>
    _(elementsMetadata)
        .map(dataList => {
            return dataList.data
                .filter(({ code }) => _.includes(filterList, code))
                .map(({ id }) => ({
                    dataDimensionItemType: dataList.type,
                    [dataList.key]: { id },
                }));
        })
        .flatten()
        .value();

export function itemsMetadataConstructor(dashboardItemsMetadata) {
    const { elementsMetadata, antigenCategory, disaggregationMetadata } = dashboardItemsMetadata;

    //const { tables, charts, globalTables } = dashboardItemsConfig;
    const { globalTables, tables } = dashboardItemsConfig;
    const allTables = { ...tables, ...globalTables };

    const tableElements = _(allTables)
        .map((item, key) => [key, dataMapper(elementsMetadata, item.elements)])
        .fromPairs()
        .value();
    /*
    const chartElements = _(charts)
        .map((item, key) =>
            item.dataType === "INDICATOR"
                ? [key, dataMapper(indicators, item.elements)]
                : [key, dataMapper(dataElements, item.elements)]
        )
        .fromPairs()
        .value();
*/

    const dashboardItemsElements = {
        antigenCategory,
        disaggregationMetadata,
        ...tableElements,
        //...chartElements,
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
/*
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
*/
const tableConstructor = ({
    id,
    datasetName,
    antigen,
    period,
    antigenCategory,
    data,
    appendCode,
    organisationUnits,
    disaggregations,
    rows,
    filterDataBy,
    area,
    title,
    legendId,
    teamRowRawDimension = null,
}) => {
    const { columns, columnDimensions, categoryDimensions } = getDimensions(
        disaggregations,
        antigen,
        antigenCategory
    );

    const categoryDimensionsWithRows = teamRowRawDimension
        ? [
              ...categoryDimensions,
              {
                  category: { id: teamRowRawDimension.categoryId },
                  categoryOptions: teamRowRawDimension.elements.map(co => ({ id: co.id })),
              },
          ]
        : categoryDimensions;

    let organisationUnitElements;
    const organisationUnitNames = organisationUnits.map(ou => ou.name).join("-");

    // Converts selected OrganisationUnits into their parents (Sites => Areas)
    if (area) {
        const organisationUnitParents = organisationUnits.map(ou => ou.parents[ou.id].split("/"));
        organisationUnitElements = organisationUnitParents.map(pArray => ({
            id: pArray[pArray.length - 2],
        }));
    } else {
        organisationUnitElements = organisationUnits.map(ou => ({ id: ou.id }));
    }

    const subName = antigen ? antigen.name : "Global";

    return {
        id,
        name: buildDashboardItemsCode(datasetName, organisationUnitNames, subName, appendCode),
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
            organisationUnitNames,
            subName,
            appendCode
        ),
        hideSubtitle: true,
        title,
        externalAccess: false,
        legendDisplayStrategy: "FIXED",
        colSubTotals: false,
        legendSet: legendId ? { id: legendId } : null,
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
        filterDimensions: _.compact([...filterDataBy, antigen ? antigenCategory : null]),
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
        organisationUnits: organisationUnitElements,
        categoryDimensions: categoryDimensionsWithRows,
        filters: filterDataBy.map(f => ({ id: f })),
        rows: rows.map(r => ({ id: r })),
        rowDimensions: rows,
    };
};
