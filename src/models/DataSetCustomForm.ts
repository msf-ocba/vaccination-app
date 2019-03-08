import { CategoryCombo } from "./db.types";
import _, { Dictionary } from "lodash";
const { createElement } = require("typed-html");

import Campaign, { Antigen } from "./campaign";
import { AntigenDisaggregationEnabled } from "./AntigensDisaggregation";
import DbD2 from "./db-d2";
import "../utils/lodash-mixins";

type Children = string[];

type Disaggregations = AntigenDisaggregationEnabled;
type DataElementDis = Disaggregations[0]["dataElements"][0];

const script = `
   $("#tabs").tabs();
`;

const css = `
    .sectionTable {
        //width: 50% !important;
    }
    .entryfield {
        //width: 2em;
    }

    .header-empty-cell {
        //width: 33%;
    }

    .header-cell {
        width: 6%;
    }
`;

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

type CustomFormMetadata = {
    [antigenDataElementCode: string]: {
        cocIdByName: Dictionary<string>;
    };
};

export class DataSetCustomForm {
    constructor(public campaign: Campaign, private metadata: CustomFormMetadata) {}

    static async build(campaign: Campaign, db: DbD2): Promise<DataSetCustomForm> {
        const disaggregations = campaign.getEnabledAntigensDisaggregation();
        const { categoryCodeForAntigens } = campaign.config;

        const info = _.flatMap(disaggregations, ({ dataElements, antigen }) => {
            return dataElements.map(({ code, categories }) => ({
                antigenCode: antigen.code,
                dataElementCode: code,
                categoryComboCode: [
                    categoryCodeForAntigens,
                    ...categories.map(category => category.code),
                ].join("_"),
            }));
        });
        const categoryCodesString = _(info)
            .map(({ categoryComboCode }) => categoryComboCode)
            .uniq()
            .join(",");
        const { categoryCombos } = await db.getMetadata<{ categoryCombos: CategoryCombo[] }>({
            categoryCombos: { filters: [`code:in:[${categoryCodesString}]`] },
        });
        const categoryCombosByCode = _.keyBy(categoryCombos, "code");
        const metadata: CustomFormMetadata = _(info)
            .map(({ antigenCode, dataElementCode, categoryComboCode }) => {
                const categoryCombo = _(categoryCombosByCode).getOrFail(categoryComboCode);
                const cocIdByName: Dictionary<string> = _(categoryCombo.categoryOptionCombos)
                    .map(coc => [coc.name, coc.id])
                    .fromPairs()
                    .value();

                return [antigenCode + "-" + dataElementCode, { cocIdByName }];
            })
            .fromPairs()
            .value();

        return new DataSetCustomForm(campaign, metadata);
    }

    renderHeaderForGroup(categoryOptionGroups: string[][]): Children {
        const total =
            _(categoryOptionGroups)
                .map(cos => cos.length)
                .reduce(_.multiply) || 0;

        const initial: { trs: string[]; count: number; repeat: number } = {
            trs: [],
            count: total,
            repeat: 1,
        };

        return _(categoryOptionGroups).reduce(({ trs, count, repeat }, categoryOptions) => {
            const newCount = count / categoryOptions.length;
            const tr = h("tr", {}, [
                h("td", { class: "header-empty-cell" }, ""),
                ...repeatArray(
                    categoryOptions.map(categoryOptionName =>
                        h(
                            "th",
                            { colspan: newCount, scope: "col", class: "header-cell" },
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
        const products = _.cartesianProduct(categoryOptionGroups);
        return h("tr", {}, [
            h("td", {}, deDis.name),
            ...products.map(categoryOptionNames =>
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

        const res = h(
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
        return res;
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
