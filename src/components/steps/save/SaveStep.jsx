import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";
import _ from "lodash";
import moment from "moment";
import { withStyles } from "@material-ui/core/styles";
import { Button } from "@material-ui/core";

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
        orgUnitNames: null,
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

    save = () => {
        console.log("TODO");
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
                <b>{label}</b>: {value || "-"}
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
        const { orgUnitNames } = this.state;
        const LiEntry = this.renderLiEntry;

        return (
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
                </ul>

                <Button className={classes.saveButton} onClick={this.save} variant="contained">
                    {i18n.t("Save")}
                </Button>
            </div>
        );
    }
}

export default withStyles(styles)(SaveStep);
