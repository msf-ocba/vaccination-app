import _ from "lodash";

export function memoize(fn: any) {
    return _.memoize(fn, (...args) => JSON.stringify(args));
}
