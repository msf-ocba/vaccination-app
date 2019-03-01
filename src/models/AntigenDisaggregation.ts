import { MetadataConfig } from "./config";
import _ from "../utils/lodash";
import { Antigen } from "./campaign";

export interface AntigenDisaggregationData {
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

export type AntigenDisaggregationCategoriesData = AntigenDisaggregationData["dataElements"][0]["categories"];

export type AntigenDisaggregationOptionGroup = AntigenDisaggregationCategoriesData[0]["options"][0];

function getOrFail<T, K extends keyof T>(obj: T, key: K): T[K] {
    const value = _.get(obj, key);
    if (value === undefined) {
        throw new Error(`Key ${key} not found in object ${JSON.stringify(obj, null, 2)}`);
    } else {
        return value;
    }
}

type AntigenDisaggregationList = {
    [code: string]: AntigenDisaggregationData;
};

export class AntigenDisaggregation {
    constructor(private config: MetadataConfig, public data: AntigenDisaggregationList) {}

    static build(config: MetadataConfig, antigens: Antigen[]): AntigenDisaggregation {
        const initial = new AntigenDisaggregation(config, {});
        return initial.setAntigens(antigens);
    }

    public setAntigens(antigens: Antigen[]): AntigenDisaggregation {
        const disaggregationByCode = _.keyBy(this.data, "code");
        const dataUpdated = _(antigens)
            .keyBy("code")
            .mapValues(
                antigen => disaggregationByCode[antigen.code] || this.buildForAntigen(antigen.code)
            )
            .value();
        return new AntigenDisaggregation(this.config, dataUpdated);
    }

    public forAntigen(antigen: Antigen): AntigenDisaggregationData {
        return this.data[antigen.code];
    }

    public set(path: (number | string)[], value: any): AntigenDisaggregation {
        const dataUpdated = _.set(this.data, path, value);
        return new AntigenDisaggregation(this.config, dataUpdated);
    }

    static getCategories(
        config: MetadataConfig,
        dataElementConfig: MetadataConfig["dataElements"][0],
        ageGroups: MetadataConfig["antigens"][0]["ageGroups"]
    ): AntigenDisaggregationCategoriesData {
        return dataElementConfig.categories.map(categoryRef => {
            const optional = categoryRef.optional;
            const { $categoryOptions, ...categoryAttributes } = getOrFail(
                _.keyBy(config.categories, "code"),
                categoryRef.code
            );

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

    buildForAntigen(antigenCode: string): AntigenDisaggregationData {
        const { config } = this;
        const antigenConfig = _(config.antigens)
            .keyBy("code")
            .get(antigenCode);

        if (!antigenConfig) throw `No configuration for antigen: ${antigenCode}`;

        const dataElementsProcessed = antigenConfig.dataElements.map(dataElementRef => {
            const dataElementConfig = getOrFail(
                _.keyBy(config.dataElements, "code"),
                dataElementRef.code
            );

            const categoriesDisaggregation = AntigenDisaggregation.getCategories(
                config,
                dataElementConfig,
                antigenConfig.ageGroups
            );

            return {
                name: dataElementConfig.name,
                code: antigenConfig.code,
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
