import { MetadataConfig } from "./config";
import _ from "lodash";
const { createElement } = require("typed-html");

import Campaign, { Antigen } from "./campaign";
import { AntigenDisaggregationEnabled, CocMetadata } from "./AntigensDisaggregation";
import i18n from "../locales";
import "../utils/lodash-mixins";

type Children = string[];
type Disaggregations = AntigenDisaggregationEnabled;
type DataElement = Disaggregations[0]["dataElements"][0];
type Category = DataElement["categories"][0];

type Maybe<T> = T | undefined;

interface ObjectWithTranslation {
    id: string;
    name: string;
    displayName: string;
    translations: Array<{ property: string; locale: string; value: string }>;
}

function h(tagName: string, attributes: object = {}, children: string | string[] = []) {
    const attrs = Object.keys(attributes).length === 0 ? undefined : attributes;
    const args = typeof children === "string" ? [children] : _.compact(children);
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
            autocomplete: "off",
        })
    );
}

function totalTh(categoryOptionGroups: string[][], isSplit: boolean): string {
    return h(
        "th",
        { rowspan: categoryOptionGroups.length, class: "data-header", "data-translate": true },
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

type Translations = { [text: string]: { [locale: string]: string } };

export class DataSetCustomForm {
    config: MetadataConfig;
    dataElementCodeDosesRegexp = /DOSES/;
    generalIndicatorsTabId = "GENERAL_QS";

    constructor(
        public campaign: Campaign,
        private metadata: CocMetadata,
        private disaggregations: Disaggregations,
        private translations: Translations
    ) {
        this.config = campaign.config;
    }

    static async build(campaign: Campaign, metadata: CocMetadata): Promise<DataSetCustomForm> {
        const disaggregations = campaign.getEnabledAntigensDisaggregation();
        const translations = await DataSetCustomForm.createTranslations(campaign, disaggregations);
        return new DataSetCustomForm(campaign, metadata, disaggregations, translations);
    }

    renderHeaderForGroup(categoryOptionGroups: string[][], isSubTotal: boolean): Children {
        const total =
            _(categoryOptionGroups)
                .map(cos => cos.length)
                .reduce(_.multiply) || 0;

        if (total === 0) {
            return [
                h("td", { class: "header-first-column" }, "&nbsp;"),
                h(
                    "th",
                    { colspan: "1", scope: "col", class: "data-header", "data-translate": true },
                    i18n.t("Value")
                ),
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
                            {
                                colspan: newCount,
                                scope: "col",
                                class: "data-header",
                                "data-translate": true,
                            },
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

    getCocIds(
        antigen: Maybe<Antigen>,
        dataElement: DataElement,
        categoryOptionGroups: string[][],
        options: { doseName?: string }
    ): string[] {
        const { doseName } = options;
        const categoryDoses = this.getDosesCategory(dataElement);
        const dosesNames =
            categoryDoses && doseName === undefined
                ? [categoryDoses.categoryOptions]
                : doseName
                ? [[doseName]]
                : [];
        const categoryOptionGroupsAll = [...dosesNames, ...categoryOptionGroups];

        return _.cartesianProduct(categoryOptionGroupsAll).map(categoryOptionNames => {
            const cocName = _([antigen ? antigen.name : null, ...categoryOptionNames])
                .compact()
                .join(", ");
            return _(this.metadata.cocIdByName).getOrFail(cocName);
        });
    }

    renderDataElement(
        antigen: Maybe<Antigen>,
        dataElement: DataElement,
        categoryOptionGroups: string[][],
        idx: number
    ): string[] {
        const trType = idx === 0 ? "primary" : "secondary";
        const trClass = ["derow", `de-${dataElement.id}`, trType].join(" ");

        // Doses are rendered as a separate data element rows
        const categoryDoses = this.getDosesCategory(dataElement);
        const dosesNames: Array<string | undefined> = categoryDoses
            ? categoryDoses.categoryOptions
            : [undefined];
        const showDoseName = dosesNames.length > 1;

        return dosesNames.map(doseName => {
            const cocIds = this.getCocIds(antigen, dataElement, categoryOptionGroups, { doseName });
            const dataElementId = dataElement.id;
            const renderTotalCell = cocIds.length > 1;

            return h("tr", { class: trClass }, [
                h("td", { class: "data-element", "data-translate": true }, [
                    h("span", { "data-translate": true }, dataElement.name),
                    showDoseName
                        ? h("span", {}, " - ") + h("span", { "data-translate": true }, doseName)
                        : null,
                ]),
                ...cocIds.map(cocId => inputTd(dataElementId, cocId)),
                renderTotalCell ? totalTd(dataElementId, cocIds) : null,
            ]);
        });
    }

    getDataElementByCategoryOptionsLists(dataElements: DataElement[]) {
        const { categoryCodeForAntigens, categoryCodeForDoses } = this.config;
        const outerCategories = [categoryCodeForAntigens, categoryCodeForDoses];

        return _(dataElements)
            .groupBy(({ categories }) =>
                categories.map(category => [category.code, ...category.categoryOptions])
            )
            .values()
            .map(dataElementsGroup => {
                const categoryOptionGroups = _(dataElementsGroup[0].categories)
                    .reject(category => _(outerCategories).includes(category.code))
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
        antigen: Maybe<Antigen>,
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
                                    _.flatMap(dataElements, dataElement =>
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

    private getDosesCategory(dataElement: DataElement): Maybe<Category> {
        const { categoryCodeForDoses } = this.config;
        return dataElement.categories.find(category => category.code === categoryCodeForDoses);
    }

    private renderTotalTables(
        antigen: Maybe<Antigen>,
        dataElements: DataElement[],
        categoryOptionGroupsArray: string[][][]
    ): Children {
        const areTablesSplit = categoryOptionGroupsArray.length > 1;
        const dataElementDoses = dataElements.find(de => !!this.getDosesCategory(de));
        const categoryDoses = dataElementDoses ? this.getDosesCategory(dataElementDoses) : null;
        const hasDosesSplit = categoryDoses && categoryDoses.categoryOptions.length > 1;
        const dataElementsToShow =
            dataElementDoses && (areTablesSplit || hasDosesSplit) ? [dataElementDoses] : [];

        return dataElementsToShow.map(dataElement =>
            h("table", { class: "dataValuesTable" }, [
                h("thead", {}, [
                    h("td", { class: "header-first-column" }),
                    h(
                        "th",
                        { class: "data-header", "data-translate": true },
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
                                this.getCocIds(antigen, dataElement, categoryOptionGroupsGroups, {})
                            )
                        ),
                    ])
                ),
            ])
        );
    }

    renderAntigenTab(disaggregation: Disaggregations[0]): string {
        const { antigen, dataElements: allDataElements } = disaggregation;
        const dataElementHasAntigenDisaggregation = (dataElement: DataElement) =>
            _(dataElement.categories).some(
                deCategory => deCategory.code == this.config.categoryCodeForAntigens
            );

        const [dosesDataElements, qualityDataElements] = _(allDataElements)
            .filter(dataElementHasAntigenDisaggregation)
            .partition(de => de.code.match(this.dataElementCodeDosesRegexp))
            .value();

        const groups = [
            { title: i18n.t("Doses administered"), dataElements: dosesDataElements },
            { title: i18n.t("Quality and safety indicators"), dataElements: qualityDataElements },
        ];

        return this.renderTab(antigen.id, groups, { antigen: disaggregation.antigen });
    }

    private renderTab(
        id: string,
        groups: Array<{ title?: string; dataElements: DataElement[] }>,
        options: { antigen?: Antigen }
    ): string {
        return h(
            "div",
            {
                id: `tab-${id}`,
                role: "tabpanel",
                class: "ui-tabs-panel ui-corner-bottom ui-widget-content",
            },
            h(
                "div",
                {},
                _.flatMap(groups, ({ title, dataElements }) => [
                    h("div", { class: "dataelement-group" }, [
                        title ? h("div", { class: "title", "data-translate": true }, title) : null,
                        h(
                            "div",
                            { class: "formSection sectionContainer" },
                            _.flatMap(
                                this.getDataElementByCategoryOptionsLists(dataElements),
                                data => this.renderGroupWrapper(options.antigen, data)
                            )
                        ),
                    ]),
                ])
            )
        );
    }

    getGeneralDataElements(disaggregations: Disaggregations): DataElement[] {
        const hasAntigensDisaggregation = (dataElement: DataElement) =>
            !_(dataElement.categories)
                .map("code")
                .includes(this.config.dataElementGroupCodeForAntigens);

        return _(disaggregations)
            .flatMap("dataElements")
            .filter(hasAntigensDisaggregation)
            .uniqBy("id")
            .value();
    }

    renderGeneralIndicatorsTab(disaggregations: Disaggregations): string | null {
        const generalDataElements = this.getGeneralDataElements(disaggregations);

        if (_(generalDataElements).isEmpty()) {
            return null;
        } else {
            return this.renderTab(
                this.generalIndicatorsTabId,
                [{ dataElements: generalDataElements }],
                {}
            );
        }
    }

    renderTabs(disaggregations: Disaggregations): string {
        const generalDataElements = this.getGeneralDataElements(disaggregations);

        const tabs = _.compact([
            ...disaggregations.map(({ antigen }) => ({ name: antigen.name, id: antigen.id })),
            !_(generalDataElements).isEmpty()
                ? { name: i18n.t("General Q&S"), id: this.generalIndicatorsTabId }
                : null,
        ]);

        return h(
            "ul",
            {
                role: "tablist",
                class:
                    "ui-tabs-nav ui-corner-all ui-helper-reset ui-helper-clearfix ui-widget-header",
            },
            tabs.map(tab =>
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
                            href: `#tab-${tab.id}`,
                            role: "presentation",
                            tabindex: "-1",
                            class: "ui-tabs-anchor",
                            "data-translate": true,
                        },
                        tab.name
                    )
                )
            )
        );
    }

    static async createTranslations(
        campaign: Campaign,
        disaggregations: Disaggregations
    ): Promise<Translations> {
        const i18nTranslations = [
            "Subtotal",
            "Total",
            "Value",
            "Doses administered",
            "Quality and safety indicators",
            "General Q&S",
        ];

        const locales = Object.keys(i18n.store.data);
        const i18nTranslations_ = _(i18nTranslations)
            .map(text => [
                i18n.t(text),
                _(locales)
                    .map(locale => [locale, i18n.t(i18n.t(text, { lng: "en" }), { lng: locale })])
                    .fromPairs()
                    .value(),
            ])
            .fromPairs()
            .value();

        const categoryOptionsIdByName = _.keyBy(campaign.config.categoryOptions, "displayName");
        const ids = [
            ..._(disaggregations)
                .flatMap(dis => dis.dataElements)
                .map("id")
                .value(),
            ..._(disaggregations)
                .flatMap(dis => dis.dataElements)
                .flatMap(dataElement => dataElement.categories)
                .flatMap(category => category.categoryOptions)
                .map(co => _(categoryOptionsIdByName).get(co).id)
                .uniq()
                .value(),
        ];

        const { categoryOptions, dataElements } = await campaign.db.getMetadata<{
            categoryOptions: ObjectWithTranslation[];
            dataElements: ObjectWithTranslation[];
        }>({
            global: {
                fields: { id: true, name: true, displayName: true, translations: true },
                filters: [`id:in:[${ids.join(",")}]`],
            },
        });

        const metadataTranslations = _(categoryOptions)
            .concat(dataElements)
            .map(object => [
                object.displayName,
                _(locales)
                    .map(locale => [
                        locale,
                        _(object.translations)
                            .filter(translation => translation.property === "NAME")
                            .keyBy("locale")
                            .get([locale, "value"]) || object.name,
                    ])
                    .fromPairs()
                    .value(),
            ])
            .fromPairs()
            .value();

        return { ...i18nTranslations_, ...metadataTranslations };
    }

    generate(): string {
        return h(
            "div",
            { id: "tabs", class: "ui-tabs ui-corner-all ui-widget ui-widget-content" },
            [
                this.renderTabs(this.disaggregations),
                ...this.disaggregations.map(disaggregation =>
                    this.renderAntigenTab(disaggregation)
                ),
                this.renderGeneralIndicatorsTab(this.disaggregations),
                h("style", {}, css),
                h(
                    "script",
                    {},
                    `var translations = ${JSON.stringify(this.translations, null, 2)};` + script
                ),
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

    var translate = function() {
        const userSettings = dhis2.de.storageManager.getUserSettings();
        const currentLocale = userSettings ? userSettings.keyDbLocale : null;

        if (!currentLocale) return;

        $("*[data-translate='']").get().forEach(el_ => {
            const el = $(el_)
            const text = el.text();
            const translation = translations[text];
            if (translation) {
                const text2 = translation[currentLocale] || translation["en"] || text;
                el.text(text2);
            }
        });
    };

    var applyChangesToForm = function() {
        highlightDataElementRows();
        processWideTables();
        translate();
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
