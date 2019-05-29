import _ from "lodash";
const { createElement } = require("typed-html");

import Campaign, { Antigen } from "./campaign";
import { AntigenDisaggregationEnabled, CustomFormMetadata } from "./AntigensDisaggregation";
import i18n from "../locales";
import "../utils/lodash-mixins";

type Children = string[];
type Disaggregations = AntigenDisaggregationEnabled;
type DataElement = Disaggregations[0]["dataElements"][0];

const dataElementCodeDosesRegexp = /DOSES/;

function h(tagName: string, attributes: object = {}, children: string | string[] = []) {
    const attrs = Object.keys(attributes).length === 0 ? undefined : attributes;
    const args = typeof children === "string" ? [children] : children;
    return createElement(tagName, attrs, ...args);
}

function repeatArray<T>(xs: T[], count: number): T[] {
    return _.flatten(_.times(count, () => xs));
}

function td(children: string, attributes: object = {}): string {
    return h("td", attributes, children);
}

function inputTd(dataElementId: string, cocId: string): string {
    return td(
        h("input", {
            name: "entryfield",
            class: "entryfield",
            id: `${dataElementId}-${cocId}-val`,
        })
    );
}

function totalTh(categoryOptionGroups: string[][], isSplit: boolean): string {
    return h(
        "th",
        { rowspan: categoryOptionGroups.length, class: "data-header" },
        h("span", { align: "center" }, isSplit ? i18n.t("Subtotal") : i18n.t("Total"))
    );
}

function totalTd(dataElementId: string, cocIds: string[]): string {
    return td(
        h("input", {
            class: "total-cell",
            id: `row-${dataElementId}-${cocIds.join("-")}`,
            disabled: "",
        })
    );
}

export class DataSetCustomForm {
    constructor(public campaign: Campaign, private metadata: CustomFormMetadata) {}

    static async build(campaign: Campaign): Promise<DataSetCustomForm> {
        const metadata = await campaign.antigensDisaggregation.getCustomFormMetadata(
            campaign.config.categoryCombos
        );
        return new DataSetCustomForm(campaign, metadata);
    }

    renderHeaderForGroup(categoryOptionGroups: string[][], isSubTotal: boolean): Children {
        const total =
            _(categoryOptionGroups)
                .map(cos => cos.length)
                .reduce(_.multiply) || 0;

        if (total === 0) {
            return [
                h("td", { class: "header-first-column" }, "&nbsp;"),
                h("th", { colspan: "1", scope: "col", class: "data-header" }, "Value"),
            ];
        }

        const headers = _.flatten(categoryOptionGroups);
        const initial: { trs: string[]; count: number; repeat: number } = {
            trs: [],
            count: total,
            repeat: 1,
        };

        return _(categoryOptionGroups).reduce(({ trs, count, repeat }, categoryOptions, idx) => {
            const newCount = count / categoryOptions.length;
            const showTotalField = headers.length > 1 && idx === 0;
            const tr = h("tr", {}, [
                h("td", { class: "header-first-column" }),
                ...repeatArray(
                    categoryOptions.map(categoryOptionName =>
                        h(
                            "th",
                            { colspan: newCount, scope: "col", class: "data-header" },
                            h("span", { align: "center" }, categoryOptionName)
                        )
                    ),
                    repeat
                ),
                showTotalField ? totalTh(categoryOptionGroups, isSubTotal) : null,
            ]);
            return {
                trs: trs.concat([tr]),
                count: newCount,
                repeat: repeat * categoryOptions.length,
            };
        }, initial).trs;
    }

    getCocId(antigen: Antigen, dataElement: DataElement, categoryOptionNames: string[]): string {
        const metadataCode = antigen.code + "-" + dataElement.code;
        const cocName = [antigen.name, ...categoryOptionNames].join(", ");
        const { cocIdByName } = _(this.metadata).getOrFail(metadataCode);
        return _(cocIdByName).getOrFail(cocName);
    }

    getCocIds(
        antigen: Antigen,
        dataElement: DataElement,
        categoryOptionGroups: string[][]
    ): string[] {
        return _.cartesianProduct(categoryOptionGroups).map(categoryOptionNames =>
            this.getCocId(antigen, dataElement, categoryOptionNames)
        );
    }

    renderDataElement(
        antigen: Antigen,
        dataElement: DataElement,
        categoryOptionGroups: string[][],
        idx: number
    ): string {
        const trType = idx === 0 ? "primary" : "secondary";
        const trClass = ["derow", `de-${dataElement.id}`, trType].join(" ");
        const cocIds = _.cartesianProduct(categoryOptionGroups).map(categoryOptionNames =>
            this.getCocId(antigen, dataElement, categoryOptionNames)
        );
        const dataElementId = dataElement.id;
        const renderTotalCell = cocIds.length > 1;

        return h("tr", { class: trClass }, [
            h("td", { class: "data-element" }, dataElement.name),
            ...cocIds.map(cocId => inputTd(dataElementId, cocId)),
            renderTotalCell ? totalTd(dataElementId, cocIds) : null,
        ]);
    }

    getDataElementByCategoryOptionsLists(dataElements: DataElement[]) {
        return _(dataElements)
            .groupBy(({ categories }) =>
                categories.map(category => [category.code, ...category.categoryOptions])
            )
            .values()
            .map(dataElementsGroup => {
                const categoryOptionGroups = _(dataElementsGroup[0].categories)
                    .map(cat => cat.categoryOptions)
                    .value();

                // Tables may be too wide to fit in the screen, so here we return a second
                // group of tables (one table per category option) to reduce the width.
                // On dataentry render, JS code (processWideTables) -run in the client-
                // will show only the table that better fits the viewport.

                return {
                    dataElements: dataElementsGroup,
                    categoryOptionGroupsList: _.compact([
                        [categoryOptionGroups],
                        _(categoryOptionGroups).size() <= 1
                            ? null
                            : categoryOptionGroups[0].map(group => [
                                  [group],
                                  ..._.tail(categoryOptionGroups),
                              ]),
                    ]),
                };
            })
            .value();
    }

    renderGroupWrapper(
        antigen: Antigen,
        data: {
            dataElements: DataElement[];
            categoryOptionGroupsList: string[][][][];
        }
    ) {
        const { dataElements, categoryOptionGroupsList } = data;

        return h(
            "div",
            { class: "tableGroupWrapper" },
            _.flatMap(categoryOptionGroupsList, categoryOptionGroupsArray =>
                h(
                    "div",
                    { class: "tableGroup" },
                    categoryOptionGroupsArray
                        .map((categoryOptionGroups, idx) =>
                            h("table", { class: "dataValuesTable" }, [
                                h(
                                    "thead",
                                    {},
                                    this.renderHeaderForGroup(
                                        categoryOptionGroups,
                                        categoryOptionGroupsArray.length > 1
                                    )
                                ),
                                h(
                                    "tbody",
                                    {},
                                    dataElements.map(dataElement =>
                                        this.renderDataElement(
                                            antigen,
                                            dataElement,
                                            categoryOptionGroups,
                                            idx
                                        )
                                    )
                                ),
                            ])
                        )
                        .concat(
                            this.renderTotalTables(antigen, dataElements, categoryOptionGroupsArray)
                        )
                )
            )
        );
    }

    private renderTotalTables(
        antigen: Antigen,
        dataElements: DataElement[],
        categoryOptionGroupsArray: string[][][]
    ): Children {
        const dataElementsToShow = categoryOptionGroupsArray.length > 1 ? dataElements : [];

        return dataElementsToShow.map(dataElement =>
            h("table", { class: "dataValuesTable" }, [
                h("thead", {}, [
                    h("td", { class: "header-first-column" }),
                    h(
                        "th",
                        { class: "data-header" },
                        h("span", { align: "center" }, i18n.t("Total"))
                    ),
                ]),
                h(
                    "tbody",
                    {},
                    h("tr", { class: `derow de-${dataElement.id} secondary` }, [
                        h("td", { class: "data-element" }, dataElement.name),
                        totalTd(
                            dataElement.id,
                            _.flatMap(categoryOptionGroupsArray, categoryOptionGroupsGroups =>
                                this.getCocIds(antigen, dataElement, categoryOptionGroupsGroups)
                            )
                        ),
                    ])
                ),
            ])
        );
    }

    renderAntigen(disaggregation: Disaggregations[0]): string {
        const { antigen, dataElements: allDataElements } = disaggregation;

        const [dosesDataElements, otherDataElements] = _.partition(allDataElements, de =>
            de.code.match(dataElementCodeDosesRegexp)
        );

        const groups = [
            { title: i18n.t("Doses administered"), dataElements: dosesDataElements },
            { title: i18n.t("Quality and safety indicators"), dataElements: otherDataElements },
        ];

        return h(
            "div",
            {
                id: `tab-${antigen.code}`,
                role: "tabpanel",
                class: "ui-tabs-panel ui-corner-bottom ui-widget-content",
            },
            h(
                "div",
                {},
                _.flatMap(groups, ({ title, dataElements }) => [
                    h("div", { class: "dataelement-group" }, [
                        h("div", { class: "title" }, title),
                        h(
                            "div",
                            { class: "formSection sectionContainer" },
                            _.flatMap(
                                this.getDataElementByCategoryOptionsLists(dataElements),
                                data => this.renderGroupWrapper(disaggregation.antigen, data)
                            )
                        ),
                    ]),
                ])
            )
        );
    }

    renderTabs(disaggregations: Disaggregations): string {
        return h(
            "ul",
            {
                role: "tablist",
                class:
                    "ui-tabs-nav ui-corner-all ui-helper-reset ui-helper-clearfix ui-widget-header",
            },
            disaggregations.map(({ antigen }) =>
                h(
                    "li",
                    {
                        role: "tab",
                        tabindex: "-1",
                        class: "ui-tabs-tab ui-corner-top ui-state-default ui-tab",
                    },
                    h(
                        "a",
                        {
                            href: `#tab-${antigen.code}`,
                            role: "presentation",
                            tabindex: "-1",
                            class: "ui-tabs-anchor",
                        },
                        antigen.name
                    )
                )
            )
        );
    }

    generate(): string {
        const disaggregations = this.campaign.getEnabledAntigensDisaggregation();

        return h(
            "div",
            { id: "tabs", class: "ui-tabs ui-corner-all ui-widget ui-widget-content" },
            [
                this.renderTabs(disaggregations),
                ...disaggregations.map(disaggregation => this.renderAntigen(disaggregation)),
                h("style", {}, css),
                h("script", {}, script),
            ]
        );
    }
}

const script = `
    var getRealDimensions = function($el_, parent) {
        var $el = $($el_.get(0));

        if ($el.length == 0) {
            return {width: 0, height: 0};
        } else {
            var $clone = $el.clone()
                .show()
                .css('visibility','hidden')
                .appendTo(parent);
            var dimensions = {
                width: $clone.outerWidth(),
                height: $clone.outerHeight(),
            };
            $clone.remove();
            return dimensions;
        }
    }

    var processWideTables = function() {
        $("#contentDiv").show();
        const contentWidth = $(".ui-tabs-panel").width();
        console.log("Content box width:", contentWidth);

        $(".tableGroupWrapper")
            .get()
            .forEach(tableGroupWrapper => {
                const tableGroups = $(tableGroupWrapper)
                    .find(".tableGroup")
                    .get();

                if (tableGroups.length <= 1) return;

                /* Show contents temporally so we can get actual rendered width of tables */

                const groups = _.chain(tableGroups)
                    .map(tableGroup => ({
                        element: tableGroup,
                        width: getRealDimensions($(tableGroup).find("table"), $("#contentDiv")).width,
                    }))
                    .sortBy(group => group.width)
                    .reverse()
                    .value();

                console.log("Tables width: " +
                    groups.map((group, idx) => "idx=" + idx + " width=" + group.width).join(" - "));

                const groupToShow = groups.find(group => group.width <= contentWidth) || groups[0];

                tableGroups.forEach(tableGroup => {
                    if (tableGroup !== groupToShow.element) {
                        $(tableGroup).remove();
                    }
                });
            });
        $("#contentDiv").hide();
    };

    var highlightDataElementRows = function() {
        var setClass = function(ev, className, isActive) {
            var tr = $(ev.currentTarget);
            var de_class = (tr.attr("class") || "")
                .split(" ")
                .filter(cl => cl.startsWith("de-"))[0];
            if (de_class) {
                var deId = de_class.split("-")[1];
                var el = $(".de-" + deId);
                el.toggleClass(className, isActive);
                if (tr.hasClass("secondary")) {
                    var opacity = isActive ? 1 : 0;
                    tr.find(".data-element")
                        .clearQueue()
                        .delay(500)
                        .animate({ opacity: opacity }, 100);
                }
            }
        };

        $("tr.derow")
            .mouseover(ev => setClass(ev, "hover", true))
            .mouseout(ev => setClass(ev, "hover", false))
            .focusin(ev => setClass(ev, "focus", true))
            .focusout(ev => setClass(ev, "focus", false));
    };

    var applyChangesToForm = function() {
        highlightDataElementRows();
        processWideTables();
        $("#tabs").tabs();
        // Set full width to data elements columns after table width has been calculated
        $(".header-first-column").addClass("full-width");
    };

    var init = function() {
        $(document).on("dhis2.de.event.formLoaded", applyChangesToForm);
    }

    init();
`;

const css = `
    .formSection  {
        border: 1px solid #cacaca;
        border-radius: 3px;
        margin: 0;
        padding: 1px 4px 1px 4px ;
    }

    .formSection h3 {
        color: #000;
        font-size: 16px;
        text-align: left;
        font-weight: bold;
        padding: 0;
    }

    .formSection td {
        text-align: center;
        min-width: 75px;
        padding: 1;
    }

    .formSection th {
        font-weight: normal;
        font-size: 14px;
        text-align: center;
        white-space: normal !important;
        max-width: 75px;
        background-color: #eaf7fb;
        max-width: 200px;
    }

    .entryfield, .total-cell, .indicator {
        max-width: 75px;
    }

    .entryarea {
        max-width: 300px;
    }

    #contentDiv input.entryfield {
        width: 70px;
        height: 18px;
        padding: 2px;
    }

    #contentDiv input.dataelementtotal {
        width: 70px;
        height: 16px;
        padding: 2px;
    }

    #contentDiv input.indicator {
        width: 70px;
        height: 18px;
        padding: 2px;
    }

    #contentDiv tr {
        border-color: transparent;
        transition: background-color 500ms linear;
    }

    #contentDiv tr.derow {
        background-color: #FFF;
    }

    #contentDiv tr.hover, #contentDiv tr:hover {
        background-color: #e5e5e5;
    }

    #contentDiv tr.focus {
        background-color: #e5f5e5;
    }

    #contentDiv th {
        border-style: hidden !important;
    }

    #contentDiv td {
        padding: 2px !important;
        height: 16px;
        text-align: center;
        border-style: none !important;
    }

    #contentDiv td.data-element {
        text-align: left;
        white-space: normal;
        max-width: 33%;
    }

    #contentDiv tr.secondary td.data-element {
        font-style: italic;
        opacity: 0;
    }

    #contentDiv .header-first-column {
        background-color: #e0e0e0;
        text-align: left;
        border-bottom-style: hidden;
        border-left-style: hidden;
        border-top-style: hidden;
        white-space: nowrap;
        background-color: #fff;
        padding: 2px !important;
    }

    #contentDiv .header-first-column.full-width {
        width: 100%;
    }

    #contentDiv th.data-header {
        text-align: center;
        border-bottom: 1px solid #ddd !important;
        background-color: #eaf7fb;
        white-space: nowrap;
        padding-top: 2px !important;
        padding-bottom: 2px !important;
        padding-left: 5px;
        padding-right: 5px;
        word-wrap: break-word;
    }

    #contentDiv .panel-default > .panel-heading {
        background-color: #3c3c3c !important;
        border-color: #3c3c3c;
        padding: 7px;
        margin-bottom: 5px;
        cursor: pointer;
    }

    .ui-state-active a, .ui-state-active a:link, .ui-state-active a:visited {
        color: #053e21;
    }

    .ui-widget-header {
        background: none;
        background-color: #2f3867;
    }

    #contentDiv .dataValuesTable {
        margin-bottom: 0px !important;
        margin-top: 5px;
    }

    .page th {
        text-align: left;
        color: #39547d;
        padding: 3px 0 3px 1px;
        font-size: 13px;
        font-weight: bold;
        border-collapse: collapse;
        border-bottom: 1px solid #cad5e5;
        min-height: 28px;
    }

    .dataelement-group {
        margin-bottom: 20px
    }

    .dataelement-group .title {
        color: #544;
        font-size: 1.2em;
        font-weight: bold;
        margin: 5px 0px 5px 0px;
    }
`;
