import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";
import { withRouter } from "react-router";
import _ from "lodash";

import Wizard from "../wizard/Wizard";
import FormHeading from "./FormHeading";
import Campaign from "models/campaign";
import DbD2 from "models/db-d2";
import OrganisationUnitsStep from "../steps/organisation-units/OrganisationUnitsStep";
import SaveStep from "../steps/save/SaveStep";
import { getValidationMessages } from "../../utils/validations";
import GeneralInfoStep from "../steps/general-info/GeneralInfoStep";

const stepsBaseInfo = [
    {
        key: "organisation-units",
        label: i18n.t("Organisation Units"),
        component: OrganisationUnitsStep,
        validationKeys: ["organisationUnits"],
        help: i18n.t(`Select organisation units assigned to this campaign.
At least one must be selected.
Only organisation units of level 6 (service) can be selected`),
    },
    {
        key: "general-info",
        label: i18n.t("General info"),
        component: GeneralInfoStep,
        validationKeys: ["name", "startDate", "endDate"],
        help: i18n.t(`Set the name of the campaign and the period in which data entry will be enabled`),
    },
    {
        key: "save",
        label: i18n.t("Save"),
        component: SaveStep,
        validationKeys: [],
        help: i18n.t(`Press the button to create the \
dataset and all the metadata associated with this vaccination campaign`),
    },
];

class CampaignWizard extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
        history: PropTypes.object.isRequired,
    };

    constructor(props) {
        super(props);
        this.state = {
            campaign: Campaign.create(new DbD2(props.d2)),
        };
    }

    goToList = () => {
        this.props.history.push("/campaign-configurator");
    };

    onChange = campaign => {
        window.campaign = campaign;
        this.setState({ campaign });
    };

    onStepChangeRequest = currentStep => {
        return getValidationMessages(this.state.campaign, currentStep.validationKeys);
    };

    render() {
        const { d2, location } = this.props;
        const { campaign } = this.state;

        const steps = stepsBaseInfo.map(step => ({
            ...step,
            props: {
                d2,
                campaign,
                onChange: this.onChange,
            },
        }));

        const urlHash = location.hash.slice(1);
        const initialStepKey = _(steps)
            .map("key")
            .includes(urlHash)
            ? urlHash
            : _(steps)
                  .map("key")
                  .first();

        return (
            <div>
                <FormHeading
                    title={i18n.t("New vaccination campaign")}
                    onBackClick={this.goToList}
                />

                <Wizard
                    steps={steps}
                    initialStepKey={initialStepKey}
                    useSnackFeedback={true}
                    onStepChangeRequest={this.onStepChangeRequest}
                />
            </div>
        );
    }
}

export default withRouter(CampaignWizard);
