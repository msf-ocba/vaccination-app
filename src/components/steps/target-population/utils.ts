import _ from "lodash";

type Maybe<T> = T | undefined;

type PairValue = {
    value: Maybe<number>;
    newValue: Maybe<number>;
};

export function getShowValue(pairValue: Maybe<PairValue>): string {
    const toStr = (v: Maybe<number>) => (_.isUndefined(v) ? "" : v.toString());

    if (!pairValue) {
        return "";
    } else if (_.isUndefined(pairValue.newValue)) {
        return toStr(pairValue.value);
    } else if (_.isNaN(pairValue.newValue)) {
        return "";
    } else {
        return toStr(pairValue.newValue);
    }
}
