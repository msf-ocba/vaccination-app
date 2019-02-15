import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";
import { withRouter } from "react-router";

import Campaign from "models/campaign";
import DbD2 from "models/db-d2";

import Wizard from "../wizard/Wizard";
import FormHeading from "./FormHeading";
import OrganisationUnitsStep from "../steps/organisation-units/OrganisationUnitsStep";
import SaveStep from "../steps/save/SaveStep";
import { getValidationMessages } from "../../utils/validations";
import GeneralInfoStep from "../steps/general-info/GeneralInfoStep";
import AntigenSelectionStep from "../steps/antigen-selection/AntigenSelectionStep";

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

    getStepsBaseInfo() {
        return [
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
                help: i18n.t(
                    `Set the name of the campaign and the period in which data entry will be enabled`
                ),
            },
            {
                key: "antigen-selection",
                label: i18n.t("Antigen selection"),
                component: AntigenSelectionStep,
                validationKeys: ["antigens"],
                help: i18n.t(`Select the antigens included in the campaign`),
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
    }

    goToList = () => {
        this.props.history.push("/campaign-configurator");
    };

    onChange = campaign => {
        this.setState({ campaign });
    };

    onStepChangeRequest = currentStep => {
        return getValidationMessages(this.state.campaign, currentStep.validationKeys);
    };

    render() {
        const { d2, location } = this.props;
        const { campaign } = this.state;
        window.campaign = campaign;

        const steps = this.getStepsBaseInfo().map(step => ({
            ...step,
            props: {
                d2,
                campaign,
                onChange: this.onChange,
            },
        }));

        const urlHash = location.hash.slice(1);
        const stepExists = steps.find(step => step.key === urlHash);
        const firstStepKey = steps.map(step => step.key)[0];
        const initialStepKey = stepExists ? urlHash : firstStepKey;

        return (
            <React.Fragment>
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
            </React.Fragment>
        );
    }
}

export default withRouter(CampaignWizard);
