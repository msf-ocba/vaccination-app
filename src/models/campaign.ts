///<reference path="../types/d2.d.ts" />

import { MetadataResponse, Section, DataElement, Category } from "./db.types";
import { generateUid } from "d2/uid";
import { DataSet, Response } from "./db.types";
import _ from "../utils/lodash";
import { PaginatedObjects, OrganisationUnitPathOnly, CategoryOption } from "./db.types";
import DbD2 from "./db-d2";
import { getDaysRange } from "../utils/date";
import { MetadataConfig, getMetadataConfig } from "./config";

export interface Data {
    name: string;
    organisationUnits: OrganisationUnitPathOnly[];
    startDate: Date | null;
    endDate: Date | null;
    antigens: CategoryOption[];
}

export interface DataElementsWithCategoryOption {
    antigen: CategoryOption;
    data: Array<{ dataElement: DataElement; categories: Category[] }>;
}

export interface AntigenDisaggregationInfo {
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

function getOrFail<T, K extends keyof T>(obj: T, key: K): T[K] {
    const value = _.get(obj, key);
    if (value === undefined) {
        throw new Error(`Key ${key} not found in object ${JSON.stringify(obj, null, 2)}`);
    } else {
        return value;
    }
}

export default class Campaign {
    public selectableLevels: number[] = [6];

    constructor(private db: DbD2, private config: MetadataConfig, private data: Data) {}

    public static create(config: MetadataConfig, db: DbD2): Campaign {
        const initialData = {
            name: "",
            organisationUnits: [],
            startDate: null,
            endDate: null,
            antigens: [],
        };

        return new Campaign(db, config, initialData);
    }

    public update(newData: Data) {
        return new Campaign(this.db, this.config, newData);
    }

    public validate() {
        const { organisationUnits, name, startDate, endDate, antigens } = this.data;

        const allOrgUnitsInAcceptedLevels = _(organisationUnits).every(ou =>
            _(this.selectableLevels).includes(
                _(ou.path)
                    .countBy()
                    .get("/") || 0
            )
        );

        return _.pickBy({
            name: !name.trim()
                ? {
                      key: "cannot_be_blank",
                      namespace: { field: "name" },
                  }
                : null,

            startDate:
                startDate && !endDate
                    ? {
                          key: "cannot_be_blank_if_other_set",
                          namespace: { field: "startDate", other: "endDate" },
                      }
                    : null,

            endDate:
                endDate && !startDate
                    ? {
                          key: "cannot_be_blank_if_other_set",
                          namespace: { field: "endDate", other: "startDate" },
                      }
                    : null,

            organisationUnits: _.compact([
                !allOrgUnitsInAcceptedLevels
                    ? {
                          key: "organisation_units_only_of_levels",
                          namespace: { levels: this.selectableLevels.join("/") },
                      }
                    : null,
                _(organisationUnits).isEmpty()
                    ? {
                          key: "no_organisation_units_selected",
                      }
                    : null,
            ]),

            antigens: _(antigens).isEmpty()
                ? {
                      key: "no_antigens_selected",
                  }
                : null,
        });
    }

    /* Organisation units */

    public async getOrganisationUnitsFullName(): Promise<PaginatedObjects<string>> {
        const ids = this.data.organisationUnits.map(ou => ou.id);
        const { pager, objects } = await this.db.getOrganisationUnitsFromIds(ids);
        const names = objects.map(ou =>
            _(ou.ancestors || [])
                .map("displayName")
                .concat([ou.displayName])
                .join("-")
        );
        return { pager, objects: names };
    }

    public setOrganisationUnits(organisationUnits: OrganisationUnitPathOnly[]): Campaign {
        // Use orgUnits only with id/path, that's the only info we get from a orgunit-tree
        return this.update({ ...this.data, organisationUnits });
    }

    public get organisationUnits(): OrganisationUnitPathOnly[] {
        return this.data.organisationUnits;
    }

    /* Name */

    public setName(name: string): Campaign {
        return this.update({ ...this.data, name });
    }

    public get name(): string {
        return this.data.name;
    }

    /* Period dates */

    public setStartDate(startDate: Date | null): Campaign {
        return this.update({ ...this.data, startDate });
    }

    public get startDate(): Date | null {
        return this.data.startDate;
    }

    public setEndDate(endDate: Date | null): Campaign {
        return this.update({ ...this.data, endDate });
    }

    public get endDate(): Date | null {
        return this.data.endDate;
    }

    /* Antigens */

    public setAntigens(antigens: CategoryOption[]): Campaign {
        return this.update({ ...this.data, antigens });
    }

    public get antigens(): CategoryOption[] {
        return this.data.antigens;
    }

    public get antigenCodes(): string[] {
        return this.antigens.map(antigen => antigen.code);
    }

    public async getAvailableAntigens(): Promise<CategoryOption[]> {
        return this.db.getCategoryOptionsByCategoryCode(this.config.categoryCodeForAntigens);
    }

    public async getAntigensDisaggregation(): Promise<AntigenDisaggregationInfo[]> {
        const antigenConfigList = _(this.config.antigens)
            .values()
            .keyBy("code")
            .at(this.antigenCodes)
            .value();

        const antigensDisaggregation = antigenConfigList.map(
            ({ name, code, dataElements, ageGroups }) => {
                const dataElementsProcessed = dataElements.map(dataElementRef => {
                    const dataElement = getOrFail(
                        _.keyBy(this.config.dataElements, "code"),
                        dataElementRef.code
                    );
                    const categories = dataElement.categories.map(categoryRef => {
                        const optional = categoryRef.optional;
                        const { $categoryOptions, ...other } = getOrFail(
                            _.keyBy(this.config.categories, "code"),
                            categoryRef.code
                        );
                        let groups;
                        if ($categoryOptions.kind === "fromAgeGroups") {
                            groups = ageGroups;
                        } else if ($categoryOptions.kind === "values") {
                            groups = $categoryOptions.values.map(option => [[option]]);
                        } else {
                            throw `Unsupported category: ${categoryRef.code}`;
                        }
                        const nestedOptions = groups.map(optionGroup => ({
                            indexSelected: 0,
                            values: optionGroup.map(options =>
                                options.map(optionName => ({ name: optionName, selected: true }))
                            ),
                        }));
                        return { ...other, optional, selected: !optional, options: nestedOptions };
                    });

                    return {
                        name: dataElement.name,
                        code,
                        categories,
                        optional: dataElementRef.optional,
                        selected: true,
                    };
                });
                return { name, code, dataElements: dataElementsProcessed };
            }
        );

        return antigensDisaggregation;
    }

    /* Save */

    public async save(): Promise<Response<string>> {
        const teamsCode = this.config.categoryComboCodeForTeams;
        const antigenCodes = this.antigens.map(antigen => antigen.code);
        const categoryCombos = await this.db.getCategoryCombosByCode([teamsCode]);
        const categoryCombosByCode = _(categoryCombos)
            .keyBy("code")
            .value();
        const categoryComboTeams = _(categoryCombosByCode).get(teamsCode);
        const dataElementsGroups = await this.db.getDataElementGroupsByCodes(antigenCodes);

        const dataElementsByAntigenCode = _(dataElementsGroups)
            .keyBy("code")
            .mapValues("dataElements")
            .value();

        if (!categoryComboTeams) {
            return { status: false, error: `Metadata not found: teamsCode=${teamsCode}` };
        } else {
            const dataSetId = generateUid();
            const dataSetElements = _(this.antigens)
                .flatMap(antigen => {
                    return _(dataElementsByAntigenCode)
                        .get(antigen.code)
                        .map(dataElement => {
                            return {
                                dataSet: { id: dataSetId },
                                dataElement: { id: dataElement.id },
                                categoryCombo: { id: dataElement.categoryCombo.id },
                            };
                        });
                })
                .value();

            const sections: Section[] = this.antigens.map(antigen => {
                return {
                    name: antigen.displayName,
                    showRowTotals: false,
                    showColumnTotals: false,
                    dataSet: { id: dataSetId },
                    dataElements: _(dataElementsByAntigenCode).get(antigen.code),
                    //greyedFields: [],
                };
            });

            const dataInputPeriods = getDaysRange(this.startDate, this.endDate).map(date => ({
                openingDate: this.startDate ? this.startDate.toISOString() : undefined,
                closingDate: this.endDate ? this.endDate.toISOString() : undefined,
                period: { id: date.format("YYYYMMDD") },
            }));

            const dataSet: DataSet = {
                id: dataSetId,
                name: this.name,
                publicAccess: "r-r-----", // Metadata can view-only, Data can view-only
                periodType: "Daily",
                categoryCombo: { id: categoryComboTeams.id },
                dataElementDecoration: true,
                renderAsTabs: true,
                organisationUnits: this.organisationUnits.map(ou => ({ id: ou.id })),
                dataSetElements,
                openFuturePeriods: 0,
                timelyDays: 0,
                expiryDays: 0,
                dataInputPeriods,
            };

            const result: MetadataResponse = await this.db.postMetadata({
                dataSets: [dataSet],
                sections: sections,
            });

            return result.status === "OK"
                ? { status: true }
                : { status: false, error: JSON.stringify(result.typeReports, null, 2) };
        }
    }
}
