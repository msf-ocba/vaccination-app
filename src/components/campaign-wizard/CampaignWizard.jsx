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
            campaign: null,
            dialogOpen: false,
        };
    }

    async componentDidMount() {
        const { d2, config, match } = this.props;

        const dbD2 = new DbD2(d2);
        const campaign = this.isEdit()
            ? await Campaign.get(config, dbD2, match.params.id)
            : Campaign.create(config, dbD2);

        if (!campaign) {
            this.props.snackbar.error(i18n.t("Cannot load campaign"));
            this.props.history.push("/campaign-configuration");
        } else {
            this.setState({ campaign });
        }
    }

    isEdit() {
        return !!this.props.match.params.id;
    }

    getStepsBaseInfo() {
        return [
            {
                key: "organisation-units",
                label: i18n.t("Organisation Units"),
                component: OrganisationUnitsStep,
                validationKeys: ["organisationUnits"],
                validationKeysLive: ["organisationUnits"],
                description: i18n.t(
                    `Select the health facilities or health area where the campaign will be implemented`
                ),
                help: i18n.t(
                    `Select the health facilities or health areas which will implement the campaign. At least one must be selected. Only organisation units of level 5 (Health site) can be selected.`
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
                    `Insert the total population and age distribution (as a percent) for each health site where the campaign will be implemented. This data will be used to calculate coverage rates for the campaign. The source of data may be (whatever that analytic tool was - create a hyperlink if possible) or you may have access to local estimates based on population surveys through the Ministry of Health or other stakeholders that would be more updated or reliable. You may overwrite any existing data in HMIS, but please note that any changes you make in this step will only be applied once you run analytics.`
                ),
                help: i18n.t(
                    `Specify the target population and population distribution by age group (percent) for each antigen.`
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

    onChange = memoize(step => async campaign => {
        const errors = await getValidationMessages(campaign, step.validationKeysLive || []);
        this.setState({ campaign });
        if (!_(errors).isEmpty()) {
            this.props.snackbar.error(errors.join("\n"));
        }
    });

    onStepChangeRequest = async currentStep => {
        return await getValidationMessages(this.state.campaign, currentStep.validationKeys);
    };

    render() {
        const { d2, location } = this.props;
        const { campaign, dialogOpen } = this.state;
        window.campaign = campaign;
        if (!campaign) return null;

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
        const lastClickableStepIndex = this.isEdit() ? steps.length - 1 : 0;
        const title = this.isEdit()
            ? i18n.t("Edit vaccination campaign")
            : i18n.t("New vaccination campaign");

        return (
            <React.Fragment>
                <ExitWizardButton
                    isOpen={dialogOpen}
                    onConfirm={this.handleConfirm}
                    onCancel={this.handleDialogCancel}
                />
                <PageHeader title={`${title}: ${campaign.name}`} onBackClick={this.cancelSave} />

                <Wizard
                    steps={steps}
                    initialStepKey={initialStepKey}
                    useSnackFeedback={true}
                    onStepChangeRequest={this.onStepChangeRequest}
                    lastClickableStepIndex={lastClickableStepIndex}
                />
            </React.Fragment>
        );
    }
}

export default withSnackbar(withRouter(CampaignWizard));
