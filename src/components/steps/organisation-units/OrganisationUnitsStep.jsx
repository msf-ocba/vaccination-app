import React from "react";
import PropTypes from "prop-types";
import OrgUnitsSelector from "../../org-units-selector/OrgUnitsSelector";
import _ from "lodash";
import { withFeedback } from "../../feedback";

class OrganisationUnitsStep extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
        campaign: PropTypes.object.isRequired,
        onChange: PropTypes.func.isRequired,
        feedback: PropTypes.func.isRequired,
    };

    setOrgUnits = orgUnitsPaths => {
        const orgUnits = orgUnitsPaths.map(path => ({
            id: _.last(path.split("/")),
            level: path.split("/").length - 1,
            path,
        }));
        const orgUnitsForAcceptedLevels = orgUnits.filter(ou =>
            this.props.campaign.selectableLevels.includes(ou.level)
        );
        const newCampaign = this.props.campaign.setOrganisationUnits(orgUnitsForAcceptedLevels);
        this.props.onChange(newCampaign);
    };

    render() {
        const { d2, campaign } = this.props;

        return (
            <OrgUnitsSelector
                d2={d2}
                onChange={this.setOrgUnits}
                selected={campaign.organisationUnits.map(ou => ou.path)}
                levels={campaign.selectableLevels}
            />
        );
    }
}

export default withFeedback(OrganisationUnitsStep);
