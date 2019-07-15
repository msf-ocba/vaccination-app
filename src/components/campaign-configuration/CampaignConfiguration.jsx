import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";
import { ConfirmationDialog, ObjectsTable, withSnackbar, withLoading } from "d2-ui-components";
import _ from "lodash";
import Checkbox from "material-ui/Checkbox/Checkbox";

import PageHeader from "../shared/PageHeader";
import { list } from "../../models/datasets";
import { formatDateShort } from "../../utils/date";
import Campaign from "../../models/campaign";
import TargetPopulationDialog from "./TargetPopulationDialog";
import { hasCurrentUserRoles } from "../../utils/permissions";
import { withPageVisited } from "../utils/page-visited-app";
import "./CampaignConfiguration.css";

class CampaignConfiguration extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
        db: PropTypes.object.isRequired,
        config: PropTypes.object.isRequired,
        snackbar: PropTypes.object.isRequired,
        loading: PropTypes.object.isRequired,
        pageVisited: PropTypes.bool,
    };

    constructor(props) {
        super(props);

        this.state = {
            dataSetsToDelete: null,
            targetPopulationDataSet: null,
            objectsTableKey: new Date(),
            filters: {
                showOnlyUserCampaigns: true,
            },
        };
    }

    hasCurrentUserRoles(userRoleNames) {
        return hasCurrentUserRoles(this.props.d2, this.props.config.userRoles, userRoleNames);
    }

    roles = this.props.config.userRoleNames;
    isCurrentUserManager = this.hasCurrentUserRoles(this.roles.manager);
    canCurrentUserSetTargetPopulation = this.hasCurrentUserRoles(this.roles.targetPopulation);

    columns = [
        { name: "displayName", text: i18n.t("Name"), sortable: true },
        { name: "publicAccess", text: i18n.t("Public access"), sortable: true },
        { name: "lastUpdated", text: i18n.t("Last updated"), sortable: true },
    ];

    initialSorting = ["displayName", "asc"];

    detailsFields = [
        { name: "displayName", text: i18n.t("Name") },
        { name: "displayDescription", text: i18n.t("Description") },
        {
            name: "startDate",
            text: i18n.t("Start Date"),
            getValue: dataSet => this.getDateValue("startDate", dataSet),
        },
        {
            name: "endDate",
            text: i18n.t("End Date"),
            getValue: dataSet => this.getDateValue("endDate", dataSet),
        },
        { name: "created", text: i18n.t("Created") },
        { name: "lastUpdated", text: i18n.t("Last update") },
        { name: "id", text: i18n.t("Id") },
        { name: "href", text: i18n.t("API link") },
    ];

    _actions = [
        {
            name: "details",
            text: i18n.t("Details"),
            multiple: false,
            type: "details",
            isPrimary: true,
        },
        {
            name: "edit",
            text: i18n.t("Edit"),
            multiple: false,
            isActive: (_d2, _dataSet) => this.isCurrentUserManager,
            onClick: dataSet =>
                this.props.history.push(`/campaign-configuration/edit/${dataSet.id}`),
        },
        {
            name: "delete",
            text: i18n.t("Delete"),
            multiple: true,
            isActive: (_d2, _dataSet) => this.isCurrentUserManager,
            onClick: dataSets => this.openDeleteConfirmation(dataSets),
        },
        {
            name: "data-entry",
            icon: "library_books",
            text: i18n.t("Go to Data Entry"),
            multiple: false,
            onClick: dataSet => this.props.history.push(`/data-entry/${dataSet.id}`),
        },
        {
            name: "dashboard",
            text: i18n.t("Go to Dashboard"),
            multiple: false,
            onClick: dataSet => this.props.history.push(`/dashboard/${dataSet.id}`),
        },
        {
            name: "target-population",
            text: i18n.t("Set Target Population"),
            icon: "people",
            multiple: false,
            isActive: () => this.canCurrentUserSetTargetPopulation,
            onClick: dataSet => this.openTargetPopulation(dataSet),
        },
    ];

    actions = _(this._actions)
        .keyBy("name")
        .at(["target-population", "data-entry", "dashboard", "details", "edit", "delete"])
        .value();

    openTargetPopulation = dataSet => {
        this.setState({ targetPopulationDataSet: dataSet });
    };

    closeTargetPopulation = () => {
        this.setState({ targetPopulationDataSet: null });
    };

    openDeleteConfirmation = dataSets => {
        this.setState({ dataSetsToDelete: dataSets });
    };

    closeDeleteConfirmation = () => {
        this.setState({ dataSetsToDelete: null });
    };

    delete = async () => {
        const { config, db, snackbar, loading } = this.props;
        const { dataSetsToDelete } = this.state;

        loading.show(true, i18n.t("Deleting campaign(s). This may take a while, please wait"), {
            count: dataSetsToDelete.length,
        });
        this.closeDeleteConfirmation();
        const response = await Campaign.delete(config, db, dataSetsToDelete);
        loading.hide();

        if (response.status) {
            snackbar.success(i18n.t("Campaign(s) deleted"));
            this.setState({ objectsTableKey: new Date() });
        } else {
            const { level, message } = response.error;
            if (level === "warning") {
                snackbar.warning(message);
            } else {
                snackbar.error(`${i18n.t("Error deleting campaign(s)")}:\n${message}`);
            }
            this.setState({ objectsTableKey: new Date() });
        }
    };

    getDateValue = (dateType, dataSet) => {
        const dataInputPeriods = dataSet.dataInputPeriods;
        let dateValue;
        switch (dateType) {
            case "startDate":
                if (!_(dataInputPeriods).isEmpty()) {
                    dateValue = formatDateShort(dataInputPeriods[0].openingDate);
                }
                break;
            case "endDate":
                if (!_(dataInputPeriods).isEmpty()) {
                    dateValue = formatDateShort(dataInputPeriods[0].closingDate);
                }
                break;
            default:
                console.error(`Date type not supported: ${dateType}`);
        }
        return dateValue;
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

    renderDeleteConfirmationDialog = ({ dataSets }) => {
        const description =
            i18n.t(
                "Are you sure you want to delete those campaign(s) (datasets and dashboards)? If you proceed, the associated datasets and dashboards will be removed from this server, but any data already registered will continue in the system"
            ) +
            "\n\n" +
            dataSets.map(ds => ds.displayName).join("\n");

        return (
            <ConfirmationDialog
                isOpen={!!dataSets}
                onSave={this.delete}
                onCancel={this.closeDeleteConfirmation}
                title={i18n.t("Delete campaign(s)")}
                description={description}
                saveText={i18n.t("Yes")}
            />
        );
    };

    render() {
        const { d2, db, config, pageVisited } = this.props;
        const { dataSetsToDelete, targetPopulationDataSet, objectsTableKey } = this.state;
        const DeleteConfirmationDialog = this.renderDeleteConfirmationDialog;
        const help = i18n.t(
            `Click the blue button to create a new campaign or select a previously created campaign that you may want to access.
Click the three dots on the right side of the screen if you wish to perform any of the following actions -> Set Target Population, Go to Data Entry, Go To Dashboards, See Details, Edit or Delete.`
        );

        return (
            <React.Fragment>
                <PageHeader
                    title={i18n.t("Campaigns")}
                    help={help}
                    onBackClick={this.backHome}
                    pageVisited={pageVisited}
                />

                <div style={styles.objectsTableContainer}>
                    <ObjectsTable
                        key={objectsTableKey}
                        model={d2.models.dataSet}
                        columns={this.columns}
                        d2={d2}
                        detailsFields={this.detailsFields}
                        pageSize={20}
                        initialSorting={this.initialSorting}
                        actions={this.actions}
                        onButtonClick={this.isCurrentUserManager ? this.onCreate : null}
                        list={this.list}
                        buttonLabel={i18n.t("Create Campaign")}
                        customFiltersComponent={this.renderCustomFilters}
                        customFilters={this.state.filters}
                    />
                </div>

                {dataSetsToDelete && <DeleteConfirmationDialog dataSets={dataSetsToDelete} />}
                {targetPopulationDataSet && (
                    <TargetPopulationDialog
                        db={db}
                        config={config}
                        dataSet={targetPopulationDataSet}
                        onClose={this.closeTargetPopulation}
                    />
                )}
            </React.Fragment>
        );
    }
}

const styles = {
    checkbox: { float: "left", width: "25%", paddingTop: 18, marginLeft: 30 },
    checkboxIcon: { marginRight: 8 },
    objectsTableContainer: { marginTop: -10 },
};

export default withLoading(withSnackbar(withPageVisited(CampaignConfiguration, "config")));
