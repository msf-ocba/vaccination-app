import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";
import _ from "lodash";
import moment from "moment";
import { withRouter } from "react-router-dom";
import { withStyles } from "@material-ui/core/styles";
import { Button, LinearProgress } from "@material-ui/core";
import { withSnackbar } from "d2-ui-components";

import { getFullOrgUnitName } from "../../../models/organisation-units";
import { getShowValue } from "../target-population/utils";
import { getFinalPopulationDistribution } from "../../../models/TargetPopulation";
import ExitWizardButton from "../../wizard/ExitWizardButton";

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
        orgUnits: null,
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
        const { objects: orgUnits } = await campaign.getOrganisationUnitsWithName();
        const campaignWithTargetPopulation = await campaign.withTargetPopulation();
        this.setState({ orgUnits, campaign: campaignWithTargetPopulation });
    }

    save = async () => {
        const { campaign } = this.state;
        this.setState({ isSaving: true, errorMessage: "" });
        const saveResponse = await campaign.save();
        this.setState({ isSaving: false });

        if (saveResponse.status) {
            this.props.snackbar.success(`${i18n.t("Campaign created")} ${campaign.name}`);
            this.props.history.push("/campaign-configuration");
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
        this.props.history.push("/campaign-configuration");
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
                {value || children ? ": " : ""}
                {value}
                {children}
            </li>
        );
    };

    getCampaignPeriodDateString = () => {
        const { campaign } = this.state;
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

    renderDataElements(dataElements) {
        const LiEntry = this.renderLiEntry;

        return dataElements.map(dataElement => {
            return <LiEntry key={dataElement.code} label={dataElement.name} />;
        });
    }

    renderOrgUnit = orgUnit => {
        const { targetPopulation } = this.state.campaign;
        const LiEntry = this.renderLiEntry;
        const byOrgUnit = _.keyBy(
            targetPopulation.targetPopulationList,
            item => item.organisationUnit.id
        );
        const targetPopOu = _(byOrgUnit).getOrFail(orgUnit.id);
        const totalPopulation = getShowValue(targetPopOu.populationTotal.pairValue);
        const populationDistribution = getFinalPopulationDistribution(
            targetPopulation.ageGroups,
            targetPopOu
        );
        const ageDistribution = targetPopulation.ageGroups
            .map(ageGroup => {
                return [ageGroup, " = ", populationDistribution[ageGroup], "%"].join("");
            })
            .join(", ");

        return (
            <LiEntry key={orgUnit.id} label={getFullOrgUnitName(orgUnit)}>
                <ul>
                    <LiEntry label={i18n.t("Total population")} value={totalPopulation} />
                    <LiEntry label={i18n.t("Age distribution (%)")} value={ageDistribution} />
                </ul>
            </LiEntry>
        );
    };

    render() {
        const { classes } = this.props;
        const { campaign, orgUnits, errorMessage, isSaving, dialogOpen } = this.state;
        if (!campaign) return null;

        const LiEntry = this.renderLiEntry;
        const disaggregation = campaign.getEnabledAntigensDisaggregation();

        return (
            <React.Fragment>
                <ExitWizardButton
                    isOpen={dialogOpen}
                    onConfirm={this.props.onCancel}
                    onCancel={this.dialogCancel}
                />
                <div className={classes.wrapper}>
                    <ul>
                        <LiEntry label={i18n.t("Name")} value={campaign.name} />

                        <LiEntry
                            label={i18n.t("Period dates")}
                            value={this.getCampaignPeriodDateString()}
                        />

                        <LiEntry label={i18n.t("Organisation Units")}>
                            {orgUnits && (
                                <React.Fragment>
                                    [{orgUnits.length}]<ul>{orgUnits.map(this.renderOrgUnit)}</ul>
                                </React.Fragment>
                            )}
                        </LiEntry>

                        <LiEntry label={i18n.t("Antigens")}>
                            [{disaggregation.length}]
                            <ul>
                                {disaggregation.map(({ antigen, dataElements }) => (
                                    <LiEntry key={antigen.code} label={antigen.name}>
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
