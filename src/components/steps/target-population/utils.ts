import _ from "lodash";

type Maybe<T> = T | undefined;

export function getShowValue(pairValue: { value: Maybe<number>; newValue: Maybe<number> }): string {
    const toStr = (v: Maybe<number>) => (_.isUndefined(v) ? "" : v.toString());

    if (_.isUndefined(pairValue.newValue)) {
        return toStr(pairValue.value);
    } else if (_.isNaN(pairValue.newValue)) {
        return "";
    } else {
        return toStr(pairValue.newValue);
    }
}
