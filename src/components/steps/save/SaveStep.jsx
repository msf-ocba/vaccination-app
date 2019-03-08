import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";
import _ from "lodash";
import moment from "moment";
import { withRouter } from "react-router-dom";
import { withStyles } from "@material-ui/core/styles";
import { Button, LinearProgress } from "@material-ui/core";
import { withSnackbar } from "d2-ui-components";
import ConfirmationDialog from "../../confirmation-dialog/ConfirmationDialog";
import { getDataElements } from "../../../models/AntigensDisaggregation";

const styles = _theme => ({
    wrapper: {
        padding: 5,
    },
    saveButton: {
        margin: 10,
        backgroundColor: "#2b98f0",
        color: "white",
    },
});

class SaveStep extends React.Component {
    state = {
        isSaving: false,
        orgUnitNames: null,
        dataElementsByCode: null,
        errorMessage: [],
        dialogOpen: false,
    };

    static propTypes = {
        d2: PropTypes.object.isRequired,
        campaign: PropTypes.object.isRequired,
        snackbar: PropTypes.object.isRequired,
        classes: PropTypes.object.isRequired,
    };

    async componentDidMount() {
        const { campaign } = this.props;
        const orgUnitNames = await campaign.getOrganisationUnitsFullName();

        const disaggregationData = campaign.getEnabledAntigensDisaggregation();
        const dataElements = await getDataElements(campaign.db, disaggregationData);
        const dataElementsByCode = _.keyBy(dataElements, "code");

        this.setState({ orgUnitNames, dataElementsByCode });
    }

    save = async () => {
        const { campaign } = this.props;
        this.setState({ isSaving: true, errorMessage: "" });
        const saveResponse = await campaign.save();
        this.setState({ isSaving: false });

        if (saveResponse.status) {
            this.props.snackbar.success(
                i18n.t("Campaign created: {{name}}", { name: campaign.name })
            );
            this.props.history.push("/campaign-configurator");
        } else {
            this.setState({ errorMessage: saveResponse.error });
            this.props.snackbar.error(i18n.t("Error saving campaign"));
        }
    };

    cancel = () => {
        this.setState({ dialogOpen: true });
    };

    confirmCancel = () => {
        this.setState({ dialogOpen: false });
        this.props.history.push("/campaign-configurator");
    };

    dialogCancel = () => {
        this.setState({ dialogOpen: false });
    };

    getMessageFromPaginated(paginatedObjects) {
        if (!paginatedObjects) {
            return i18n.t("Loading...");
        } else {
            const { pager, objects } = paginatedObjects;
            const othersCount = pager.total - objects.length;
            const names =
                _(objects)
                    .sortBy()
                    .join(", ") || i18n.t("[None]");
            if (othersCount > 0) {
                return i18n.t("[{{total}}] {{names}} and {{othersCount}} other(s)", {
                    total: pager.total,
                    names,
                    othersCount,
                });
            } else {
                return `[${pager.total}] ${names}`;
            }
        }
    }

    renderLiEntry = ({ label, value, children }) => {
        return (
            <li key={label}>
                {label}
                {value || children ? ":" : ""}
                {value}
                {children}
            </li>
        );
    };

    getCampaignPeriodDateString = () => {
        const { campaign } = this.props;
        const { startDate, endDate } = campaign;

        if (startDate && endDate) {
            return [
                moment(campaign.startDate).format("LL"),
                "->",
                moment(campaign.endDate).format("LL"),
            ].join(" ");
        } else {
            return "-";
        }
    };

    renderDataElements(dataElementRefs) {
        const { dataElementsByCode } = this.state;
        const LiEntry = this.renderLiEntry;
        const dataElements = _(dataElementsByCode)
            .at(_.map(dataElementRefs, "code"))
            .compact()
            .value();

        return dataElements.map(dataElement => {
            return <LiEntry key={dataElement.code} label={dataElement.displayName} />;
        });
    }

    render() {
        const { classes, campaign } = this.props;
        const { orgUnitNames, errorMessage, isSaving, dialogOpen } = this.state;
        const LiEntry = this.renderLiEntry;
        const disaggregation = campaign.getEnabledAntigensDisaggregation();
        const antigenNamesByCode = _(campaign.antigens)
            .keyBy("code")
            .mapValues("name")
            .value();

        return (
            <React.Fragment>
                <ConfirmationDialog
                    dialogOpen={dialogOpen}
                    handleConfirm={this.confirmCancel}
                    handleCancel={this.dialogCancel}
                    title={i18n.t("Cancel Campaign Creation?")}
                    contents={i18n.t(
                        "You are about to exit the campaign creation wizard. All your changes will be lost. Are you sure?"
                    )}
                />
                <div className={classes.wrapper}>
                    <h3>{i18n.t("Setup is finished. Press the button Save to save the data")}</h3>

                    <ul>
                        <LiEntry label={i18n.t("Name")} value={campaign.name} />

                        <LiEntry
                            label={i18n.t("Period dates")}
                            value={this.getCampaignPeriodDateString()}
                        />
                        <LiEntry
                            label={i18n.t("Organisation Units")}
                            value={this.getMessageFromPaginated(orgUnitNames)}
                        />

                        <LiEntry label={i18n.t("Antigens")}>
                            <ul>
                                {disaggregation.map(({ code, dataElements }) => (
                                    <LiEntry key={code} label={antigenNamesByCode[code]}>
                                        <ul>{this.renderDataElements(dataElements)}</ul>
                                    </LiEntry>
                                ))}
                            </ul>
                        </LiEntry>
                    </ul>

                    <Button onClick={this.cancel} variant="contained">
                        {i18n.t("Cancel")}
                    </Button>
                    <Button className={classes.saveButton} onClick={this.save} variant="contained">
                        {i18n.t("Save")}
                    </Button>

                    {isSaving && <LinearProgress />}

                    <pre>{errorMessage}</pre>
                </div>
            </React.Fragment>
        );
    }
}

export default withSnackbar(withRouter(withStyles(styles)(SaveStep)));
