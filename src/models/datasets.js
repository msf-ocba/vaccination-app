import _ from "lodash";
import DbD2 from "./db-d2";
import Campaign from "./campaign";

const fields = [
    "id",
    "name",
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
    "dataInputPeriods~paging=(1;1)",
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
    return { pager: collection.pager, objects: collection.toArray() };
}

async function getByAttribute(config, d2) {
    const appCode = config.attributeCodeForApp;
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
                    ({ attribute, value }) =>
                        attribute && attribute.code === appCode && value === "true"
                )
        )
        .map(el => el.id);
    return ids;
}

export async function getDashboardId(d2, dataSet, config) {
    const db = new DbD2(d2);
    const campaign = await Campaign.get(config, db, dataSet.id);
    const dashboard = campaign ? await campaign.getDashboardOrCreate() : undefined;
    return dashboard ? dashboard.id : undefined;
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
