import _ from "lodash";

export function getShowValue(value: number | undefined): string {
    if (_.isUndefined(value) || _.isNaN(value)) {
        return "";
    } else {
        return value.toString();
    }
}
