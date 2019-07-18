import _ from "lodash";
import "./lodash-mixins";
import { Category } from "../models/db.types";

interface SortConfig {
    categoryComboCodeForAgeGroup: string;
    categories: Category[];
}

export function sortAgeGroups(config: SortConfig, names: string[]): string[] {
    const ageGroupCategory = _(config.categories)
        .keyBy("code")
        .getOrFail(config.categoryComboCodeForAgeGroup);

    const indexByName: _.Dictionary<number> = _(ageGroupCategory.categoryOptions)
        .map((co, idx) => [co.displayName, idx])
        .fromPairs()
        .value();

    return _.sortBy(names, name => indexByName[name] || 0);
}
