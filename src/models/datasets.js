import _ from "lodash";
import { formatDateLong } from "../utils/date";

const fields = [
    "id",
    "displayName",
    "displayDescription",
    "shortName",
    "created",
    "lastUpdated",
    "externalAccess",
    "publicAccess",
    "userAccesses",
    "userGroupAccesses",
    "user",
    "access",
    "attributeValues[value, attribute[code]]",
    "dataInputPeriods",
    "href",
];

function cleanOptions(options) {
    return _.omitBy(options, value => _.isArray(value) && _.isEmpty(value));
}

export async function list(config, d2, filters, pagination) {
    const { search, showOnlyUserCampaigns } = filters || {};
    const { page, pageSize = 20, sorting } = pagination || {};
    // order=FIELD:DIRECTION where direction = "iasc" | "idesc" (insensitive ASC, DESC)
    const [field, direction] = sorting || [];
    const order = field && direction ? `${field}:i${direction}` : undefined;
    const vaccinationIds = await getByAttribute(config, d2);
    const filter = _.compact([
        search ? `displayName:ilike:${search}` : null,
        showOnlyUserCampaigns ? `user.id:eq:${d2.currentUser.id}` : null,
        `id:in:[${vaccinationIds.join(",")}]`,
    ]);
    const listOptions = { fields, filter, page, pageSize, order };
    const collection = await d2.models.dataSets.list(cleanOptions(listOptions));
    collection.toArray().forEach(dataSet => {
        const dataInputPeriods = dataSet.dataInputPeriods;
        if (!_(dataInputPeriods).isEmpty()) {
            dataSet.startDate = formatDateLong(dataInputPeriods[0].openingDate);
            dataSet.endDate = formatDateLong(dataInputPeriods[0].closingDate);
        }
    });
    return { pager: collection.pager, objects: collection.toArray() };
}

async function getByAttribute(config, d2) {
    const appCode = config.attibuteCodeForApp;
    const filter = `attributeValues.attribute.code:eq:${appCode}`;
    const listOptions = {
        filter,
        fields: ["id", "attributeValues[value, attribute[code]]"],
        paging: false,
    };
    const dataSets = await d2.models.dataSets.list(listOptions);
    const ids = dataSets
        .toArray()
        .filter(
            ({ attributeValues }) =>
                !!attributeValues.some(
                    ({ attribute, value }) => attribute.code === appCode && value === "true"
                )
        )
        .map(el => el.id);
    return ids;
}

export function getDashboardId(dataSet, config) {
    return _(dataSet.attributeValues || [])
        .filter(av => av.attribute.code === config.attributeCodeForDashboard)
        .map(av => av.value)
        .first();
}

export async function getOrganisationUnitsById(id, d2) {
    const fields = "organisationUnits[id,name]";
    const dataSet = await d2.models.dataSets.get(id, { fields }).catch(() => undefined);
    const organisationUnits = dataSet ? dataSet.organisationUnits.toArray() : null;
    //TODO: Make it so the user can choose the OU
    return _(organisationUnits).isEmpty() ? undefined : organisationUnits[0].id;
}

export async function getDataInputPeriodsById(id, d2) {
    const fields = "dataInputPeriods";
    const dataSet = await d2.models.dataSets.get(id, { fields }).catch(() => undefined);
    const dataInputPeriods = dataSet.dataInputPeriods;
    return _(dataInputPeriods).isEmpty() ? undefined : dataInputPeriods[0];
}

export async function getDatasetById(id, d2) {
    const fields = ["id", "attributeValues[value, attribute[code]]"].join(",");
    const dataSet = await d2.models.dataSets.get(id, { fields }).catch(() => undefined);
    return dataSet;
}
