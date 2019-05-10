import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";
import { ConfirmationDialog, ObjectsTable, withSnackbar, withLoading } from "d2-ui-components";
import _ from "lodash";

import Checkbox from "material-ui/Checkbox/Checkbox";

import PageHeader from "../shared/PageHeader";
import { canManage, canUpdate, canCreate } from "d2-ui-components/auth";
import { list } from "../../models/datasets";
import { formatDateShort } from "../../utils/date";
import Campaign from "../../models/campaign";
import DbD2 from "../../models/db-d2";

class CampaignConfiguration extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
        config: PropTypes.object.isRequired,
        snackbar: PropTypes.object.isRequired,
        loading: PropTypes.object.isRequired,
    };

    constructor(props) {
        super(props);
        this.db = new DbD2(props.d2);

        this.state = {
            dataSetsToDelete: null,
            objectsTableKey: new Date(),
            filters: {
                showOnlyUserCampaigns: true,
            },
        };
    }

    canCreateDataSets = canCreate(this.props.d2, this.props.d2.models.dataSet, "public");

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
            onClick: dataSets => this.openDeleteConfirmation(dataSets),
        },
        {
            name: "dataEntry",
            icon: "library_books",
            // TODO: isActive: (d2, dataSet) => canUpdate(d2, d2.models.dataSet, [dataSet]),
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
            name: "download",
            icon: "cloud_download",
            text: i18n.t("Download data"),
            multiple: false,
        },
    ];

    openDeleteConfirmation = dataSets => {
        this.setState({ dataSetsToDelete: dataSets });
    };

    closeDeleteConfirmation = () => {
        this.setState({ dataSetsToDelete: null });
    };

    delete = async () => {
        const { config, snackbar, loading } = this.props;
        const { dataSetsToDelete } = this.state;

        loading.show(true, i18n.t("Deleting campaign(s). This may take a while, please wait"), {
            count: dataSetsToDelete.length,
        });
        this.closeDeleteConfirmation();
        const response = await Campaign.delete(config, this.db, dataSetsToDelete);
        loading.hide();

        if (response.status) {
            snackbar.success(i18n.t("Campaign(s) deleted"));
            this.setState({ objectsTableKey: new Date() });
        } else {
            snackbar.error(`${i18n.t("Error deleting campaign(s)")}:\n${response.error}`);
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
                "Are you sure you want to delete those campaign(s) (dataset and dashboards)?"
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
        const { d2 } = this.props;
        const { dataSetsToDelete, objectsTableKey } = this.state;
        const DeleteConfirmationDialog = this.renderDeleteConfirmationDialog;

        return (
            <React.Fragment>
                <PageHeader title={i18n.t("Campaigns")} onBackClick={this.backHome} />

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
                        onCreate={this.canCreateDataSets ? this.onCreate : null}
                        list={this.list}
                        customFiltersComponent={this.renderCustomFilters}
                        customFilters={this.state.filters}
                    />
                </div>

                {dataSetsToDelete && <DeleteConfirmationDialog dataSets={dataSetsToDelete} />}
            </React.Fragment>
        );
    }
}

const styles = {
    checkbox: { float: "left", width: "25%", paddingTop: 18, marginLeft: 30 },
    checkboxIcon: { marginRight: 8 },
    objectsTableContainer: { marginTop: -10 },
};

export default withLoading(withSnackbar(CampaignConfiguration));
