import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";
import { withRouter } from "react-router";
import _ from "lodash";
import { withSnackbar } from "d2-ui-components";

import Campaign from "models/campaign";
import DbD2 from "models/db-d2";
import Wizard from "../wizard/Wizard";
import PageHeader from "../shared/PageHeader";
import OrganisationUnitsStep from "../steps/organisation-units/OrganisationUnitsStep";
import SaveStep from "../steps/save/SaveStep";
import { getValidationMessages } from "../../utils/validations";
import GeneralInfoStep from "../steps/general-info/GeneralInfoStep";
import AntigenSelectionStep from "../steps/antigen-selection/AntigenSelectionStep";
import DisaggregationStep from "../steps/disaggregation/DisaggregationStep";
import { memoize } from "../../utils/memoize";
import TargetPopulationStep from "../steps/target-population/TargetPopulationStep";
import ExitWizardButton from "../wizard/ExitWizardButton";

class CampaignWizard extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
        history: PropTypes.object.isRequired,
        config: PropTypes.object.isRequired,
        snackbar: PropTypes.object.isRequired,
    };

    constructor(props) {
        super(props);

        const campaign = Campaign.create(props.config, new DbD2(props.d2));

        this.state = {
            campaign: campaign,
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
                description: i18n.t(
                    `Select the health facilities or health area where the campaign will be implemented`
                ),
                help: i18n.t(
                    `Select the organisation units which will implement the campaign. At least one must be selected. Only organisation units of level 5 (Health site) can be selected.`
                ),
            },
            {
                key: "general-info",
                label: i18n.t("General info"),
                component: GeneralInfoStep,
                validationKeys: ["name", "startDate", "endDate"],
                description: i18n.t(
                    `Name your campaign and choose dates for which data entry will be enabled`
                ),
                help: i18n.t(
                    `Give your campaign a name that will make it easy to recognize in an HMIS hierarchy. Suggested format is REACTIVE_VACC_LOCATION_ANTIGEN(S) _MONTH_YEAR\n
                    The start and end date should define the period for which you expect to enter data - i.e .the first and last day of your campaign. If you are not certain of the end date, enter a date a few weeks later than the expected date of completion (refer to your microplan). It is possible to edit the dates at any point.`
                ),
            },
            {
                key: "antigen-selection",
                label: i18n.t("Antigen selection"),
                component: AntigenSelectionStep,
                validationKeys: ["antigens"],
                description: i18n.t(`Select the antigens which will be administered`),
                help: i18n.t(`Select the antigens which will be administered.`),
            },
            {
                key: "disaggregation",
                label: i18n.t("Configure Indicators"),
                component: DisaggregationStep,
                validationKeys: ["antigensDisaggregation"],
                validationKeysLive: ["antigensDisaggregation"],
                description: i18n.t(`Select indicators and categories for each antigen`),
                help: i18n.t(`Select the indicators and breakdowns that you wish to monitor for each antigen in your campaign.\n
                Standard age groups for each antigen appear by default. In some cases, you may click on an age group to select subdivisions if that information is important for your campaign. Compulsory indicators may not be un-selected.`),
            },
            {
                key: "target-population",
                label: i18n.t("Target Population"),
                component: TargetPopulationStep,
                validationKeys: ["targetPopulation"],
                description: i18n.t(
                    `Specify target population, totals and age percentages for the age ranges required by all selected antigens. The source of those values are the DHIS2 analytics endpoint. Like-wise, any change you make in this step will only be applied once you run the analytics.`
                ),
                help: i18n.t(
                    `Specify target population, totals and age percentages for the age ranges required by all selected antigens.`
                ),
            },
            {
                key: "save",
                label: i18n.t("Save"),
                component: SaveStep,
                validationKeys: [],
                description: i18n.t(
                    'Setup of your campaign is complete. Click the "Save" button to save your campaign and access tally sheets, data entry or analysis'
                ),
                help: i18n.t(`Press the button to create the \
dataset and all the metadata associated with this vaccination campaign.`),
            },
        ];
    }

    cancelSave = () => {
        this.setState({ dialogOpen: true });
    };

    handleConfirm = () => {
        this.setState({ dialogOpen: false });
        this.props.history.push("/campaign-configuration");
    };

    handleDialogCancel = () => {
        this.setState({ dialogOpen: false });
    };

    onChange = memoize(step => campaign => {
        const errors = getValidationMessages(campaign, step.validationKeysLive || []);
        if (_(errors).isEmpty()) {
            this.setState({ campaign });
        } else {
            this.props.snackbar.error(errors.join("\n"));
        }
    });

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
                onChange: this.onChange(step),
                onCancel: this.handleConfirm,
            },
        }));

        const urlHash = location.hash.slice(1);
        const stepExists = steps.find(step => step.key === urlHash);
        const firstStepKey = steps.map(step => step.key)[0];
        const initialStepKey = stepExists ? urlHash : firstStepKey;

        return (
            <React.Fragment>
                <ExitWizardButton
                    isOpen={dialogOpen}
                    onConfirm={this.handleConfirm}
                    onCancel={this.handleDialogCancel}
                />

                <PageHeader
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

export default withSnackbar(withRouter(CampaignWizard));
