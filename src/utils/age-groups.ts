import _ from "lodash";

export function sortAgeGroups(names: string[]) {
    const timeUnits: _.Dictionary<number> = { d: 1, w: 7, m: 30, y: 365 };
    const getOrThrow = _.getOrFail;

    return _.sortBy(names, name => {
        const parts = name.split(" ");
        let pair;
        if (parts.length === 4) {
            // "2 - 5 y"
            const days = getOrThrow(timeUnits, parts[3]);
            pair = [parseInt(parts[0]) * days, parseInt(parts[2]) * days];
        } else if (parts.length === 5) {
            // "2 w - 3 y" {
            const days1 = getOrThrow(timeUnits, parts[1]);
            const days2 = getOrThrow(timeUnits, parts[4]);
            pair = [parseInt(parts[0]) * days1, parseInt(parts[3]) * days2];
        } else if (parts.length === 3) {
            // ""> 30 y"
            const days = getOrThrow(timeUnits, parts[2]);
            pair = [parseInt(parts[1]) * days, 0];
        } else {
            throw new Error(`Invalid age range format: ${name}`);
        }

        return 100000 * pair[0] + pair[1];
    });
}
