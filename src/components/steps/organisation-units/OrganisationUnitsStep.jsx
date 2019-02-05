import React from "react";
import PropTypes from "prop-types";
import OrgUnitsSelector from "../../org-units-selector/OrgUnitsSelector";
import _ from "lodash";
import { withFeedback, levels } from "../../feedback";
import { getValidationMessages } from "../../../utils/validations";

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
            path,
        }));

        const newCampaign = this.props.campaign.setOrganisationUnits(orgUnits);
        const messages = getValidationMessages(newCampaign, ["organisationUnits"]);

        if (!_(messages).isEmpty()) {
            this.props.feedback(levels.ERROR, messages.join("\n"));
        } else {
            this.props.onChange(newCampaign);
        }
    };

    render() {
        const { d2, campaign } = this.props;

        return (
            <OrgUnitsSelector
                d2={d2}
                onChange={this.setOrgUnits}
                selected={campaign.getOrganisationUnits().map(ou => ou.path)}
            />
        );
    }
}

export default withFeedback(OrganisationUnitsStep);
