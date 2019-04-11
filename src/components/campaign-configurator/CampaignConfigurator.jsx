import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";
import { ObjectsTable, withSnackbar } from "d2-ui-components";

import Checkbox from "material-ui/Checkbox/Checkbox";

import PageHeader from "../shared/PageHeader";
import { canManage, canDelete, canUpdate, canCreate } from "d2-ui-components/auth";
import { list, getDashboardId } from "../../models/datasets";
import { goToDhis2Url } from "../../utils/routes";

class CampaignConfigurator extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
        config: PropTypes.object.isRequired,
        snackbar: PropTypes.object.isRequired,
    };

    state = {
        filters: {
            showOnlyUserCampaigns: true,
        },
    };

    canCreateDataSets = canCreate(this.props.d2, this.props.d2.models.dataSet, "public");

    columns = [
        { name: "displayName", text: i18n.t("Name"), sortable: true },
        { name: "publicAccess", text: i18n.t("Public access"), sortable: true },
        { name: "lastUpdated", text: i18n.t("Last updated"), sortable: true },
    ];

    initialSorting = ["displayName", "asc"];

    detailsFields = [
        { name: "displayName", text: i18n.t("Name") },
        { name: "shortName", text: i18n.t("Short name") },
        { name: "code", text: i18n.t("Code") },
        { name: "displayDescription", text: i18n.t("Description") },
        { name: "created", text: i18n.t("Created") },
        { name: "lastUpdated", text: i18n.t("Last update") },
        { name: "id", text: i18n.t("Id") },
        { name: "href", text: i18n.t("API link") },
    ];

    actions = [
        {
            name: "details",
            text: i18n.t("Details"),
            multiple: false,
            type: "details",
        },
        {
            name: "edit",
            text: i18n.t("Edit"),
            multiple: false,
            isActive: (d2, dataSet) => canUpdate(d2, d2.models.dataSet, [dataSet]),
            onClick: dataSet => console.log("TODO:edit", dataSet),
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
            // isActive: (d2, dataSet) => canUpdate(d2, d2.models.dataSet, [dataSet]),
            text: i18n.t("Go to Data Entry"),
            multiple: false,
            onClick: dataSet => this.props.history.push(`/data-entry/${dataSet.id}`),
        },
        {
            name: "dashboard",
            text: i18n.t("Go to Dashboard"),
            multiple: false,
            onClick: dataSet => this.goToDashboard(dataSet),
        },
        {
            name: "download",
            icon: "cloud_download",
            text: i18n.t("Download data"),
            multiple: false,
        },
    ];

    goToDashboard = dataSet => {
        const dashboardId = getDashboardId(dataSet, this.props.config);
        if (dashboardId) {
            goToDhis2Url(`/dhis-web-dashboard/#/${dashboardId}`);
        } else {
            this.props.snackbar.error(i18n.t("Cannot find dashboard associated to the campaign"));
        }
    };

    onCreate = () => {
        this.props.history.push("/campaign-configuration/new");
    };

    toggleShowOnlyUserCampaigns = ev => {
        const newFilters = { showOnlyUserCampaigns: ev.target.checked };
        this.setState(state => ({ filters: { ...state.filters, ...newFilters } }));
    };

    renderCustomFilters = () => {
        const { showOnlyUserCampaigns } = this.state.filters;

        return (
            <Checkbox
                style={styles.checkbox}
                checked={showOnlyUserCampaigns}
                data-test="only-my-campaigns"
                label={i18n.t("Only my campaigns")}
                onCheck={this.toggleShowOnlyUserCampaigns}
                iconStyle={styles.checkboxIcon}
            />
        );
    };

    list = (...listArgs) => {
        const { config } = this.props;
        return list(config, ...listArgs);
    };

    backHome = () => {
        this.props.history.push("/");
    };

    render() {
        const { d2 } = this.props;

        return (
            <React.Fragment>
                <PageHeader title={i18n.t("Campaigns")} onBackClick={this.backHome} />
                <div style={styles.objectsTableContainer}>
                    <ObjectsTable
                        model={d2.models.dataSet}
                        columns={this.columns}
                        d2={d2}
                        detailsFields={this.detailsFields}
                        pageSize={20}
                        initialSorting={this.initialSorting}
                        actions={this.actions}
                        onCreate={this.canCreateDataSets ? this.onCreate : null}
                        list={this.list}
                        customFiltersComponent={this.renderCustomFilters}
                        customFilters={this.state.filters}
                    />
                </div>
            </React.Fragment>
        );
    }
}

const styles = {
    checkbox: { float: "left", width: "25%", paddingTop: 18, marginLeft: 30 },
    checkboxIcon: { marginRight: 8 },
    objectsTableContainer: { marginTop: -10 },
};

export default withSnackbar(CampaignConfigurator);
