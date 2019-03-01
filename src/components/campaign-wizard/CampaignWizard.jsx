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
import ConfirmationDialog from "../confirmation-dialog/ConfirmationDialog";
import DisaggregationStep from "../steps/disaggregation/DisaggregationStep";

class CampaignWizard extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
        history: PropTypes.object.isRequired,
        config: PropTypes.object.isRequired,
    };

    constructor(props) {
        super(props);
        this.state = {
            campaign: Campaign.create(props.config, new DbD2(props.d2))
                .setName("My campaign test")
                .setAntigens([
                    { name: "Measles", code: "RVC_ANTIGEN_MEASLES" },
                    { name: "Cholera", code: "RVC_ANTIGEN_CHOLERA" },
                    { name: "Typhoid Fever", code: "RVC_ANTIGEN_TYPHOID_FEVER" },
                ])
                .setOrganisationUnits([
                    {
                        id: "uv6XHrWbjPi",
                        path:
                            "/zOyMxdCLXBM/G7g4TvbjFlX/lmelleX7G5X/ll8gkZ6djJG/ajVmyibuQR1/uv6XHrWbjPi",
                    },
                ]),
            dialogOpen: false,
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
                key: "disaggregation",
                label: i18n.t("Disaggregation"),
                component: DisaggregationStep,
                validationKeys: [],
                help: i18n.t(`Define disaggration categories for each antigen`),
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

    cancelSave = () => {
        this.setState({ dialogOpen: true });
    };

    handleConfirm = () => {
        this.setState({ dialogOpen: false });
        this.props.history.push("/campaign-configurator");
    };

    handleDialogCancel = () => {
        this.setState({ dialogOpen: false });
    };

    onChange = campaign => {
        this.setState({ campaign });
    };

    onStepChangeRequest = currentStep => {
        return getValidationMessages(this.state.campaign, currentStep.validationKeys);
    };

    render() {
        const { d2, location } = this.props;
        const { campaign, dialogOpen } = this.state;
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
                <ConfirmationDialog
                    dialogOpen={dialogOpen}
                    handleConfirm={this.handleConfirm}
                    handleCancel={this.handleDialogCancel}
                    title={i18n.t("Cancel Campaign Creation?")}
                    contents={i18n.t(
                        "You are about to exit the campaign creation wizard. All your changes will be lost. Are you sure?"
                    )}
                />
                <FormHeading
                    title={i18n.t("New vaccination campaign")}
                    onBackClick={this.cancelSave}
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
