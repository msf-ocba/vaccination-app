import _ from "lodash";
import { OrganisationUnit } from "./db.types";

export function getFullOrgUnitName(orgUnit: OrganisationUnit) {
    return _(orgUnit.ancestors || [])
        .concat([orgUnit])
        .map("displayName")
        .join(" -> ");
}
