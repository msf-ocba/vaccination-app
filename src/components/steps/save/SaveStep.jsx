import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";
import _ from "lodash";
import moment from "moment";
import { withRouter } from "react-router-dom";
import { withStyles } from "@material-ui/core/styles";
import { Button, LinearProgress } from "@material-ui/core";
import { withFeedback, levels } from "../../feedback";

const styles = theme => ({
    wrapper: {
        padding: 5,
    },
    saveButton: {
        margin: 10,
    },
});

class SaveStep extends React.Component {
    state = {
        isSaving: false,
        orgUnitNames: null,
        errorMessage: [],
    };

    static propTypes = {
        d2: PropTypes.object.isRequired,
        campaign: PropTypes.object.isRequired,
    };

    async componentDidMount() {
        const { campaign } = this.props;
        const orgUnitNames = await campaign.getOrganisationUnitsFullName();
        this.setState({ orgUnitNames });
    }

    save = async () => {
        const { campaign } = this.props;
        this.setState({ isSaving: true, errorMessage: "" });
        const saveResponse = await campaign.save();
        this.setState({ isSaving: false });

        if (saveResponse.status) {
            this.props.feedback(
                levels.SUCCESS,
                i18n.t("Campaign created: {{name}}", { name: campaign.name })
            );
            this.props.history.push("/campaign-configurator");
        } else {
            this.setState({ errorMessage: saveResponse.error });
            this.props.feedback(levels.ERROR, i18n.t("Error saving campaign"));
        }
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

    renderLiEntry = ({ label, value }) => {
        return (
            <li key={label}>
                {label}: <i>{value || "-"}</i>
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

    render() {
        const { classes, campaign } = this.props;
        const { orgUnitNames, errorMessage, isSaving } = this.state;
        const LiEntry = this.renderLiEntry;
        const antigens = _(campaign.antigens)
            .map("displayName")
            .join(", ");

        return (
            <div className={classes.wrapper}>
                <h3>{i18n.t("Setup is finished. Press the button Save to save the data")}</h3>

                <ul>
                    <LiEntry label={i18n.t("Name")} value={campaign.name} />
                    <LiEntry label={i18n.t("Antigens")} value={antigens} />
                    <LiEntry
                        label={i18n.t("Period dates")}
                        value={this.getCampaignPeriodDateString()}
                    />
                    <LiEntry
                        label={i18n.t("Organisation Units")}
                        value={this.getMessageFromPaginated(orgUnitNames)}
                    />
                </ul>

                <Button className={classes.saveButton} onClick={this.save} variant="contained">
                    {i18n.t("Save")}
                </Button>

                {isSaving && <LinearProgress />}

                <pre>{errorMessage}</pre>
            </div>
        );
    }
}

export default withFeedback(withRouter(withStyles(styles)(SaveStep)));
