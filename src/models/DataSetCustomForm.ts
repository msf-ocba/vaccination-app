import _ from "lodash";
const { createElement } = require("typed-html");

import Campaign, { Antigen } from "./campaign";
import { AntigenDisaggregationEnabled, CustomFormMetadata } from "./AntigensDisaggregation";
import DbD2 from "./db-d2";
import "../utils/lodash-mixins";

type Children = string[];

type Disaggregations = AntigenDisaggregationEnabled;
type DataElementDis = Disaggregations[0]["dataElements"][0];

function h(tagName: string, attributes: object, children: string | string[]) {
    const attrs = Object.keys(attributes).length === 0 ? undefined : attributes;
    const args = typeof children === "string" ? [children] : children;
    return createElement(tagName, attrs, ...args);
}

function sortDataElements(dataElements: DataElementDis[]): DataElementDis[] {
    return _(dataElements)
        .orderBy([de => de.code.match(/DOSES/), "code"], ["asc", "asc"])
        .value();
}

function repeatArray<T>(xs: T[], count: number): T[] {
    return _.flatten(_.times(count, () => xs));
}

export class DataSetCustomForm {
    constructor(public campaign: Campaign, private metadata: CustomFormMetadata) {}

    static async build(campaign: Campaign, db: DbD2): Promise<DataSetCustomForm> {
        const metadata = await campaign.antigensDisaggregation.getCustomFormMetadata(
            db,
            campaign.antigens
        );
        return new DataSetCustomForm(campaign, metadata);
    }

    renderHeaderForGroup(categoryOptionGroups: string[][]): Children {
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

        const initial: { trs: string[]; count: number; repeat: number } = {
            trs: [],
            count: total,
            repeat: 1,
        };

        return _(categoryOptionGroups).reduce(({ trs, count, repeat }, categoryOptions) => {
            const newCount = count / categoryOptions.length;
            const tr = h("tr", {}, [
                h("td", { class: "header-first-column" }, ""),
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
            ]);
            return {
                trs: trs.concat([tr]),
                count: newCount,
                repeat: repeat * categoryOptions.length,
            };
        }, initial).trs;
    }

    getCocId(antigen: Antigen, deDis: DataElementDis, categoryOptionNames: string[]): string {
        const metadataCode = antigen.code + "-" + deDis.code;
        const cocName = [antigen.name, ...categoryOptionNames].join(", ");
        const { cocIdByName } = _(this.metadata).getOrFail(metadataCode);
        const cocId = _(cocIdByName).getOrFail(cocName);
        const deId = deDis.id;
        return h(
            "input",
            { name: "entryfield", class: "entryfield", id: `${deId}-${cocId}-val` },
            ""
        );
    }

    renderDataElement(
        antigen: Antigen,
        deDis: DataElementDis,
        categoryOptionGroups: string[][]
    ): string {
        return h("tr", {}, [
            h("td", { class: "data-element" }, deDis.name),
            ..._.cartesianProduct(categoryOptionGroups).map(categoryOptionNames =>
                h("td", {}, this.getCocId(antigen, deDis, categoryOptionNames))
            ),
        ]);
    }

    renderAntigen(disaggregation: Disaggregations[0]): string {
        const { antigen, dataElements } = disaggregation;

        const groups = _(sortDataElements(dataElements))
            .groupBy(({ categories }) =>
                categories.map(category => [category.code, ...category.categoryOptions])
            )
            .values()
            .map(group => {
                const categoryOptionGroups = _(group[0].categories)
                    .map(cat => cat.categoryOptions)
                    .value();
                return { dataElements: group, categoryOptionGroups };
            })
            .value();

        return h(
            "div",
            {
                id: `tab-${antigen.code}`,
                role: "tabpanel",
                class: "ui-tabs-panel ui-corner-bottom ui-widget-content",
            },
            h(
                "div",
                { class: "formSection sectionContainer" },
                groups.map(group =>
                    h("table", { class: "sectionTable" }, [
                        h("thead", {}, this.renderHeaderForGroup(group.categoryOptionGroups)),
                        h(
                            "tbody",
                            {},
                            group.dataElements.map(deDis =>
                                this.renderDataElement(
                                    disaggregation.antigen,
                                    deDis,
                                    group.categoryOptionGroups
                                )
                            )
                        ),
                    ])
                )
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
   $("#tabs").tabs();
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

    .entryfield, .indicator {
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

    #contentDiv tr.derow {
        background-color: #FFF;
    }

    #contentDiv tr.focus {
        background-color: #e5f5e5;
    }

    #contentDiv tr.hover, #contentDiv tr:hover {
        background-color: #e5e5e5;
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
    }

    #contentDiv .header-first-column {
        backgroud-color: #e0e0e0;
        text-align: left;
        border-bottom-style: hidden;
        border-left-style: hidden;
        border-top-style: hidden;
        width: 100%;
        white-space: nowrap;
        background-color: #fff;
        padding: 2px !important;
    }

    #contentDiv th.data-header {
        text-align: center;
        border-bottom: 1px solid #ddd !important;
        background-color: #eaf7fb;
        white-space: nowrap;
        padding-top: 2px !important;
        padding-bottom: 2px !important;
        padding-left: 10px;
        padding-right: 10px;
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

    #contentDiv .sectionTable {
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
`;
