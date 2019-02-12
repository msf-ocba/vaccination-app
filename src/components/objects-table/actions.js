import { canManage, canDelete, canUpdate } from "utils/auth";
import _ from "utils/lodash";
import i18n from "@dhis2/d2-i18n";

const setupActions = (onClick, actions) => {
    const actionsByName = _.keyBy(actions, "name");
    const contextMenuIcons = _(actions)
        .map(a => [a.name, a.icon || a.name])
        .fromPairs()
        .value();

    const isContextActionAllowed = function(d2, selection, actionName) {
        const action = actionsByName[actionName];
        const arg = action && !action.multiple && _.isArray(selection) ? selection[0] : selection;

        if (!action || !selection || selection.length === 0) {
            return false;
        } else if (!action.multiple && selection.length !== 1) {
            return false;
        } else if (action.isActive && !action.isActive(d2, arg)) {
            return false;
        } else {
            return true;
        }
    };

    const contextActions = actions.map(action => {
        const handler = data => {
            const arg = action.multiple && !_.isArray(data) ? [data] : data;
            onClick(action.name, arg);
        };
        return { name: action.name, text: action.text, fn: handler };
    });

    return { contextActions, contextMenuIcons, isContextActionAllowed };
};

export function get(onClick) {
    return setupActions(onClick, [
        {
            name: "details",
            text: i18n.t("Details"),
            multiple: false,
        },
        {
            name: "edit",
            text: i18n.t("Edit"),
            multiple: false,
            isActive: (d2, dataSet) => canUpdate(d2, d2.models.dataSet, [dataSet]),
        },
        {
            name: "share",
            text: i18n.t("Share"),
            multiple: true,
            isActive: (d2, dataSets) => canManage(d2, d2.models.dataSet, dataSets),
        },
        {
            name: "delete",
            text: i18n.t("Delete"),
            multiple: true,
            isActive: (d2, dataSets) => canDelete(d2, d2.models.dataSet, dataSets),
        },
        {
            name: "dataEntry",
            icon: "library_books",
            text: i18n.t("Go to Data Entry"),
            multiple: false,
        },
        {
            name: "dashboard",
            text: i18n.t("Go to Dashboard"),
            multiple: false,
        },
        {
            name: "download",
            icon: "cloud_download",
            text: i18n.t("Download data"),
            multiple: false,
        },
    ]);
}
