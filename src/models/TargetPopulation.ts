import _ from "lodash";

import DbD2 from "./db-d2";
import { MetadataConfig } from "./config";
import {
    OrganisationUnit,
    OrganisationUnitPathOnly,
    Maybe,
    OrganisationUnitLevel,
    DataValue,
} from "./db.types";
import { AntigenDisaggregationEnabled } from "./AntigensDisaggregation";

const levelsConfig = {
    levelForPopulation: 5,
    levelsForAgeDistribution: [{ level: 4, isEditable: false }, { level: 5, isEditable: true }],
};

export type TargetPopulationList = Array<TargetPopulationItem>;

export type TargetPopulationData = {
    organisationUnitLevels: OrganisationUnitLevel[];
    antigensDisaggregation: AntigenDisaggregationEnabled;
    targetPopulationList: TargetPopulationList;
    ageGroups: string[];
};

type PairValue = {
    value: Maybe<number>;
    newValue: Maybe<number>;
};

interface AgeDistribution {
    [ageGroup: string]: PairValue;
}

type PopulationTotal = {
    organisationUnit: OrganisationUnit;
    pairValue: PairValue;
};

export type PopulationDistribution = {
    isEditable: boolean;
    organisationUnit: OrganisationUnit;
    ageDistribution: AgeDistribution;
};

export interface TargetPopulationItem {
    organisationUnit: OrganisationUnit;
    populationTotal: PopulationTotal;
    populationDistributions: PopulationDistribution[];
}

export interface AgeGroupSelector {
    ouIndex: number;
    distributionIdx: number;
    ageGroup: string;
}

export class TargetPopulation {
    constructor(
        private config: MetadataConfig,
        private db: DbD2,
        public data: TargetPopulationData
    ) {}

    static build(config: MetadataConfig, db: DbD2): TargetPopulation {
        return new TargetPopulation(config, db, {
            organisationUnitLevels: config.organisationUnitLevels,
            targetPopulationList: [],
            antigensDisaggregation: [],
            ageGroups: [],
        });
    }

    public validate(): Array<{ key: string; namespace: _.Dictionary<string> }> {
        const totalPopulationValidations = this.data.targetPopulationList.map(targetPopOu => {
            const value = getValue(targetPopOu.populationTotal.pairValue);
            return _.isUndefined(value) || _.isNaN(value) || value <= 0
                ? {
                      key: "total_population_invalid",
                      namespace: {
                          organisationUnit: targetPopOu.organisationUnit.displayName,
                          value: (value || "-").toString(),
                      },
                  }
                : null;
        });

        const ageGroupPopulationValidations = this.data.targetPopulationList.map(targetPopOu => {
            const finalPopulationDistribution = getFinalPopulationDistribution(
                this.data.ageGroups,
                targetPopOu
            );

            const ageGroupsInvalid = this.data.ageGroups.filter(ageGroup => {
                const value = finalPopulationDistribution[ageGroup];
                return _.isUndefined(value) || _.isNaN(value) || value < 0 || value > 100;
            });

            return _(ageGroupsInvalid).isEmpty()
                ? null
                : {
                      key: "age_groups_population_invalid",
                      namespace: {
                          ageGroups: ageGroupsInvalid.join(", "),
                          organisationUnit: targetPopOu.organisationUnit.displayName,
                      },
                  };
        });

        const ageGroupAntigensValidations = _.flatMap(
            this.data.targetPopulationList,
            targetPopOu => {
                const finalPopulationDistribution = getFinalPopulationDistribution(
                    this.data.ageGroups,
                    targetPopOu
                );

                return this.data.antigensDisaggregation.map(antigen => {
                    const sumForAntigenAgeGroups = _(antigen.ageGroups)
                        .map(ageGroup => finalPopulationDistribution[ageGroup] || 0)
                        .sum();

                    return sumForAntigenAgeGroups > 100
                        ? {
                              key: "age_groups_population_for_antigen_invalid",
                              namespace: {
                                  organisationUnit: targetPopOu.organisationUnit.displayName,
                                  antigen: antigen.antigen.name,
                                  ageGroups: antigen.ageGroups.join(" + "),
                                  value: `${sumForAntigenAgeGroups}% > 100%`,
                              },
                              name,
                          }
                        : null;
                });
            }
        );

        return _([
            ...totalPopulationValidations,
            ...ageGroupPopulationValidations,
            ...ageGroupAntigensValidations,
        ])
            .compact()
            .value();
    }

    public async update(
        orgUnitsPathOnly: OrganisationUnitPathOnly[],
        antigensDisaggregation: AntigenDisaggregationEnabled,
        period: string
    ): Promise<TargetPopulation> {
        const ouIds = orgUnitsPathOnly.map(ou => ou.id);
        const ageGroupsForAllAntigens = _(antigensDisaggregation)
            .flatMap(({ ageGroups }) => ageGroups)
            .uniq()
            .value();

        const { organisationUnits } = await this.db.getMetadata<{
            organisationUnits: OrganisationUnit[];
        }>({
            organisationUnits: { filters: [`id:in:[${ouIds}]`] },
        });

        const totalPopulationsByOrgUnit = await this.getTotalPopulation(organisationUnits, period);
        const ageDistributionByOrgUnit = await this.getPopulationDistributions(
            organisationUnits,
            ageGroupsForAllAntigens,
            period
        );

        const targetPopulationList: TargetPopulationItem[] = organisationUnits.map(orgUnit => {
            const populationTotal = _(totalPopulationsByOrgUnit).get(orgUnit.id);

            return {
                organisationUnit: orgUnit,
                populationTotal,
                populationDistributions: _(ageDistributionByOrgUnit).get(orgUnit.id),
            };
        });

        return new TargetPopulation(this.config, this.db, {
            ...this.data,
            antigensDisaggregation,
            targetPopulationList,
            ageGroups: ageGroupsForAllAntigens,
        });
    }

    setTotalPopulation(ouIndex: number, value: number) {
        const newData = _.set(
            this.data,
            ["targetPopulationList", ouIndex, "populationTotal", "pairValue", "newValue"],
            value
        );
        return new TargetPopulation(this.config, this.db, newData);
    }

    setAgeGroupPopulation(agrGroup: AgeGroupSelector, value: number) {
        const newData = _.set(
            this.data,
            [
                "targetPopulationList",
                agrGroup.ouIndex,
                "populationDistributions",
                agrGroup.distributionIdx,
                "ageDistribution",
                agrGroup.ageGroup,
                "newValue",
            ],
            value
        );
        return new TargetPopulation(this.config, this.db, newData);
    }

    public get ageGroups() {
        return this.data.ageGroups;
    }

    public get organisationUnitLevels() {
        return this.data.organisationUnitLevels;
    }

    public get targetPopulationList(): TargetPopulationList {
        return this.data.targetPopulationList;
    }

    public getDataValues(period: string): DataValue[] {
        const { config } = this;
        const catCombosByCode = _.keyBy(config.categoryCombos, "code");
        const getCocsByName = (catComboCode: string): { [cocName: string]: string } => {
            const catCombo = _(catCombosByCode).getOrFail(catComboCode);
            return _(catCombo.categoryOptionCombos)
                .keyBy("name")
                .mapValues("id")
                .value();
        };

        const dataValues = _.flatMap(this.data.targetPopulationList, targetPopulationItem => {
            const totalPopulation = get(
                getValue(targetPopulationItem.populationTotal.pairValue),
                "No value for total population"
            );
            const newValue = getNewValue(targetPopulationItem.populationTotal.pairValue);
            const totalPopulationDataValues = _.isUndefined(newValue)
                ? []
                : [
                      {
                          period,
                          orgUnit: targetPopulationItem.populationTotal.organisationUnit.id,
                          dataElement: config.population.totalPopulationDataElement.id,
                          value: newValue.toString(),
                      },
                  ];
            const finalDistribution = getFinalPopulationDistribution(
                this.data.ageGroups,
                targetPopulationItem
            );

            const antigenAgeGroupCocsByName = getCocsByName(
                config.categoryComboCodeForAntigenAgeGroup
            );
            const populationByAgeDataValues = _(finalDistribution)
                .flatMap((ageGroupPercent_, ageGroup) => {
                    const ageGroupPercent = get(
                        ageGroupPercent_,
                        `Value not found for age group ${ageGroup}`
                    );

                    return _(this.data.antigensDisaggregation)
                        .map(({ antigen, ageGroups: ageGroupsForAntigen }) => {
                            const cocName = [antigen.name, ageGroup].join(", ");
                            if (!_(ageGroupsForAntigen).includes(ageGroup)) {
                                return null;
                            } else {
                                const populationForAgeRange = Math.round(
                                    (totalPopulation * ageGroupPercent) / 100
                                );

                                return {
                                    period,
                                    orgUnit: targetPopulationItem.organisationUnit.id,
                                    dataElement: config.population.populationByAgeDataElement.id,
                                    categoryOptionCombo: _(antigenAgeGroupCocsByName).getOrFail(
                                        cocName
                                    ),
                                    value: populationForAgeRange.toString(),
                                };
                            }
                        })
                        .compact()
                        .value();
                })
                .value();

            const ageGroupCocsByName = getCocsByName(config.categoryComboCodeForAgeGroup);
            const ageDistributionDataValues = _.flatMap(
                targetPopulationItem.populationDistributions,
                populationDistribution => {
                    return _(this.data.ageGroups)
                        .map(ageGroup => {
                            const pairValue = _(populationDistribution.ageDistribution).getOrFail(
                                ageGroup
                            );
                            const newValue = getNewValue(pairValue);
                            return newValue
                                ? {
                                      period,
                                      orgUnit: populationDistribution.organisationUnit.id,
                                      dataElement: config.population.ageDistributionDataElement.id,
                                      categoryOptionCombo: _(ageGroupCocsByName).getOrFail(
                                          ageGroup
                                      ),
                                      value: newValue.toString(),
                                  }
                                : null;
                        })
                        .compact()
                        .value();
                }
            );

            return _.concat(
                totalPopulationDataValues,
                ageDistributionDataValues,
                populationByAgeDataValues
            );
        });

        return dataValues;
    }

    private async getTotalPopulation(
        organisationUnits: OrganisationUnit[],
        period: string
    ): Promise<{ [ouId: string]: PopulationTotal }> {
        const organisationUnitsForTotalPopulation: { [ouId: string]: OrganisationUnit } = _(
            organisationUnits
        )
            .map(orgUnit => {
                const ouForTotalPopulation = _(orgUnit.ancestors || [])
                    .concat([orgUnit])
                    .find(ou => ou.level == levelsConfig.levelForPopulation);
                if (!ouForTotalPopulation)
                    throw new Error(`No ancestor found for orgUnit: ${orgUnit.id}`);
                return [orgUnit.id, ouForTotalPopulation];
            })
            .fromPairs()
            .value();

        const { headers, rows } = await this.db.getAnalytics({
            dimension: [
                "dx:" + this.config.population.totalPopulationDataElement.id,
                "pe:" + period,
                "ou:" +
                    _(organisationUnitsForTotalPopulation)
                        .values()
                        .map(ou => ou.id)
                        .join(";"),
            ],
        });

        const rowByOrgUnit = _(rows)
            .map(row =>
                _(headers)
                    .map("name")
                    .zip(row)
                    .fromPairs()
                    .value()
            )
            .keyBy("ou")
            .value();

        const existing = _.keyBy(this.data.targetPopulationList, tp => tp.organisationUnit.id);

        return _.mapValues(organisationUnitsForTotalPopulation, (ou, ouIdForPopulation) => {
            const strValue = _(rowByOrgUnit).get([ou.id, "value"]);
            const newValueExisting = !_(existing).has(ouIdForPopulation)
                ? undefined
                : existing[ouIdForPopulation].populationTotal.pairValue.newValue;
            return {
                organisationUnit: ou,
                pairValue: {
                    value: strValue ? parseInt(strValue) : undefined,
                    newValue: newValueExisting,
                },
            };
        });
    }

    private async getPopulationDistributions(
        organisationUnits: OrganisationUnit[],
        ageGroupsForAllAntigens: string[],
        period: string
    ): Promise<{ [ouId: string]: PopulationDistribution[] }> {
        const organisationUnitsForAgeDistribution: { [ouId: string]: OrganisationUnit[] } = _(
            organisationUnits
        )
            .map(orgUnit => {
                const ousForAgeDistribution = (orgUnit.ancestors || [])
                    .concat([orgUnit])
                    .filter(ancestorOu =>
                        _(levelsConfig.levelsForAgeDistribution)
                            .map("level")
                            .includes(ancestorOu.level)
                    );
                if (_(ousForAgeDistribution).isEmpty())
                    throw new Error(`No org units for age distribution found: ou=${orgUnit.id}`);
                return [orgUnit.id, ousForAgeDistribution];
            })
            .fromPairs()
            .value();

        const { ageGroupCategory, ageDistributionDataElement } = this.config.population;

        const { headers, rows } = await this.db.getAnalytics({
            dimension: [
                "dx:" + ageDistributionDataElement.id,
                ageGroupCategory.id,
                "pe:" + period,
                "ou:" +
                    _(organisationUnitsForAgeDistribution)
                        .values()
                        .flatten()
                        .map("id")
                        .join(";"),
            ],
        });

        const rowsByOrgUnit = _(rows)
            .map(row =>
                _(headers)
                    .map("name")
                    .zip(row)
                    .fromPairs()
                    .value()
            )
            .groupBy("ou")
            .value();

        const ageGroupCategoryOptionById = _.keyBy(ageGroupCategory.categoryOptions, "id");
        const existing = _.keyBy(this.data.targetPopulationList, tp => tp.organisationUnit.id);

        const populationDistributions = _.mapValues(
            organisationUnitsForAgeDistribution,
            (ous, campaingOuId) =>
                ous.map((ou, distributionIdx) => {
                    const rows = _(rowsByOrgUnit).get(ou.id);

                    const ageDistribution = _(rows)
                        .map(row => {
                            const ageGroupCategoryOptionId = _(row).getOrFail(ageGroupCategory.id);
                            const categoryOption = _(ageGroupCategoryOptionById).getOrFail(
                                ageGroupCategoryOptionId
                            );
                            return [categoryOption.displayName, parseInt(row.value)];
                        })
                        .fromPairs()
                        .value();

                    const ageDistributionWithAllAgeGroups = _(ageGroupsForAllAntigens)
                        .map(ageGroup => {
                            const newValueExisting =
                                existing[campaingOuId] &&
                                existing[campaingOuId].populationDistributions[distributionIdx] &&
                                existing[campaingOuId].populationDistributions[distributionIdx]
                                    .ageDistribution[ageGroup]
                                    ? existing[campaingOuId].populationDistributions[
                                          distributionIdx
                                      ].ageDistribution[ageGroup].newValue
                                    : undefined;

                            return [
                                ageGroup,
                                {
                                    value: _(ageDistribution).get(ageGroup),
                                    newValue: newValueExisting,
                                },
                            ];
                        })
                        .fromPairs()
                        .value();

                    const isEditableByLevel = _(levelsConfig.levelsForAgeDistribution)
                        .keyBy("level")
                        .mapValues("isEditable");

                    return {
                        isEditable: isEditableByLevel.getOrFail(ou.level),
                        organisationUnit: ou,
                        ageDistribution: ageDistributionWithAllAgeGroups,
                    };
                })
        );

        return populationDistributions;
    }
}

export function getFinalPopulationDistribution(
    ageGroups: string[],
    targetPopOu: TargetPopulationItem
): { [ageGroup: string]: Maybe<number> } {
    // TODO: Return AgeDistribution instead
    return _(ageGroups)
        .map(ageGroup => [
            ageGroup,
            _(targetPopOu.populationDistributions)
                .map(distribution => getValue(distribution.ageDistribution[ageGroup]))
                .reject(x => _.isUndefined(x) || _.isNaN(x))
                .last(),
        ])
        .fromPairs()
        .value();
}

function get<T>(value: Maybe<T>, errorMsg: string): T {
    if (_.isUndefined(value)) {
        throw new Error(errorMsg);
    } else {
        return value;
    }
}

function getValue(pairValue: PairValue): Maybe<number> {
    if (_.isUndefined(pairValue.newValue)) {
        return pairValue.value;
    } else {
        return pairValue.newValue;
    }
}

function getNewValue(pairValue: PairValue): Maybe<number> {
    const { value, newValue } = pairValue;

    if (!_.isUndefined(pairValue.newValue) && value !== newValue) {
        return newValue;
    } else {
        return undefined;
    }
}
