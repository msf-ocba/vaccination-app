import _ from "lodash";
import { AntigenDisaggregation } from "./AntigensDisaggregation";
import { MetadataConfig } from "./config";
import { Antigen } from "./campaign";
import "../utils/lodash-mixins";

export interface AntigenDisaggregation {
    name: string;
    code: string;

    dataElements: Array<{
        name: string;
        code: string;
        selected: boolean;
        optional: boolean;

        categories: Array<{
            name: string;
            code: string;
            optional: boolean;
            selected: boolean;

            options: Array<{
                indexSelected: number;
                values: Array<Array<{ name: string; selected: boolean }>>;
            }>;
        }>;
    }>;
}

export type AntigenDisaggregationCategoriesData = AntigenDisaggregation["dataElements"][0]["categories"];

export type AntigenDisaggregationOptionGroup = AntigenDisaggregationCategoriesData[0]["options"][0];

export type AntigenDisaggregationEnabled = Array<{
    antigen: string;
    dataElements: Array<{
        dataElement: string;
        categories: Array<{ category: string; categoryOptions: string[] }>;
    }>;
}>;

type AntigensDisaggregationData = {
    [code: string]: AntigenDisaggregation;
};

export class AntigensDisaggregation {
    constructor(private config: MetadataConfig, public data: AntigensDisaggregationData) {}

    static build(config: MetadataConfig, antigens: Antigen[]): AntigensDisaggregation {
        const initial = new AntigensDisaggregation(config, {});
        return initial.setAntigens(antigens);
    }

    public setAntigens(antigens: Antigen[]): AntigensDisaggregation {
        const disaggregationByCode = _.keyBy(this.data, "code");
        const dataUpdated = _(antigens)
            .keyBy("code")
            .mapValues(
                antigen => disaggregationByCode[antigen.code] || this.buildForAntigen(antigen.code)
            )
            .value();
        return new AntigensDisaggregation(this.config, dataUpdated);
    }

    public forAntigen(antigen: Antigen): AntigenDisaggregation | undefined {
        return this.data[antigen.code];
    }

    public set(path: (number | string)[], value: any): AntigensDisaggregation {
        const dataUpdated = _.set(this.data, path, value);
        return new AntigensDisaggregation(this.config, dataUpdated);
    }

    static getCategories(
        config: MetadataConfig,
        dataElementConfig: MetadataConfig["dataElements"][0],
        ageGroups: MetadataConfig["antigens"][0]["ageGroups"]
    ): AntigenDisaggregationCategoriesData {
        return dataElementConfig.categories.map(categoryRef => {
            const optional = categoryRef.optional;
            const { $categoryOptions, ...categoryAttributes } = _(config.categories)
                .keyBy("code")
                .getOrFail(categoryRef.code);

            let groups;
            if ($categoryOptions.kind === "fromAgeGroups") {
                groups = ageGroups;
            } else if ($categoryOptions.kind === "fromAntigens") {
                groups = config.antigens.map(antigen => [[antigen.name]]);
            } else {
                groups = $categoryOptions.values.map(option => [[option]]);
            }

            const nestedOptions = groups.map(optionGroup => ({
                indexSelected: 0,
                values: optionGroup.map(options =>
                    options.map(optionName => ({ name: optionName, selected: true }))
                ),
            }));

            return { ...categoryAttributes, optional, selected: !optional, options: nestedOptions };
        });
    }

    getEnabled(antigens: Antigen[]): AntigenDisaggregationEnabled {
        const antigenDisaggregations = _(antigens)
            .map(this.forAntigen)
            .compact()
            .value();

        return antigenDisaggregations.map(antigenDisaggregation => {
            const dataElements = _(antigenDisaggregation.dataElements)
                .filter("selected")
                .map(dataElement => {
                    const categories = _(dataElement.categories)
                        .filter("selected")
                        .map(category => {
                            const categoryOptions = _(category.options)
                                .flatMap(({ values, indexSelected }) => values[indexSelected])
                                .filter("selected")
                                .map("name")
                                .value();
                            return { category: category.code, categoryOptions };
                        })
                        .value();
                    return { dataElement: dataElement.code, categories };
                })
                .value();
            return { antigen: antigenDisaggregation.code, dataElements };
        });
    }

    buildForAntigen(antigenCode: string): AntigenDisaggregation {
        const { config } = this;
        const antigenConfig = _(config.antigens)
            .keyBy("code")
            .get(antigenCode);

        if (!antigenConfig) throw `No configuration for antigen: ${antigenCode}`;

        const dataElementsProcessed = antigenConfig.dataElements.map(dataElementRef => {
            const dataElementConfig = _(config.dataElements)
                .keyBy("code")
                .getOrFail(dataElementRef.code);

            const categoriesDisaggregation = AntigensDisaggregation.getCategories(
                config,
                dataElementConfig,
                antigenConfig.ageGroups
            );

            return {
                name: dataElementConfig.name,
                code: dataElementConfig.code,
                categories: categoriesDisaggregation,
                optional: dataElementRef.optional,
                selected: true,
            };
        });

        const res = {
            name: antigenConfig.name,
            code: antigenConfig.code,
            dataElements: dataElementsProcessed,
        };

        return res;
    }
}
