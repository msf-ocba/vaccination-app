import React from "react";
import Linkify from "react-linkify";
import _ from "lodash";
import { withSnackbar, ConfirmationDialog } from "d2-ui-components";
import {
    LinearProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
} from "@material-ui/core";

import i18n from "../../locales";
import { Maybe } from "../../models/db.types";
import TargetPopulation from "../target-population/TargetPopulation";
import DbD2 from "../../models/db-d2";
import Campaign from "../../models/campaign";
import { MetadataConfig } from "../../models/config";
import { getValidationMessages } from "../../utils/validations";

interface Props {
    dataSet: { id: string; displayName: string };
    config: MetadataConfig;
    onClose: () => void;
    db: DbD2;
    snackbar: any;
}

interface State {
    campaign: Maybe<Campaign>;
    isSaving: boolean;
    changed: boolean;
    confirmClose: boolean;
}

class TargetPopulationDialog extends React.Component<Props, State> {
    state: State = {
        campaign: undefined,
        isSaving: false,
        changed: false,
        confirmClose: false,
    };

    styles = {
        progress: { marginTop: 10 },
    };

    async componentDidMount() {
        const { dataSet, db, config, onClose, snackbar } = this.props;

        try {
            const campaign = await Campaign.get(config, db, dataSet.id);
            const campaignWithTargetPopulation = await campaign.withTargetPopulation();
            this.setState({ campaign: campaignWithTargetPopulation });
        } catch (err) {
            snackbar.error(i18n.t("Cannot load campaign") + ": " + (err.message || err));
            onClose();
        }
    }

    save = async () => {
        const { onClose, snackbar } = this.props;
        const { campaign, isSaving } = this.state;

        if (!campaign || isSaving) return;

        this.setState({ isSaving: true });
        const errors = await getValidationMessages(campaign, ["targetPopulation"]);

        if (!_(errors).isEmpty()) {
            this.setState({ isSaving: false });
            snackbar.error(errors.join("\n"));
            return;
        }

        try {
            const saveResponse = await campaign.saveTargetPopulation();

            if (saveResponse.status) {
                snackbar.success(`${i18n.t("Target population set")}: ${campaign.name}`);
                onClose();
            } else {
                this.setState({ isSaving: false });
                snackbar.error(i18n.t("Error saving target population"));
            }
        } catch (err) {
            console.error(err);
            snackbar.error(err.message || err.toString());
            this.setState({ isSaving: false });
        }
    };

    onChange = (newCampaign: Campaign) => {
        this.setState({ campaign: newCampaign, changed: true });
    };

    requestClose = () => {
        const { onClose } = this.props;
        const { changed } = this.state;

        if (changed) {
            this.setState({ confirmClose: true });
        } else {
            onClose();
        }
    };

    confirmClose = () => {
        this.props.onClose();
    };

    cancelClose = () => {
        this.setState({ confirmClose: false });
    };

    confirmationCloseDialog = () => {
        const { onClose } = this.props;

        return (
            <ConfirmationDialog
                isOpen={true}
                onSave={onClose}
                onCancel={this.cancelClose}
                title={i18n.t(
                    "There are unsaved changes, are you sure you want to close the dialog?"
                )}
                cancelText={i18n.t("No")}
                saveText={i18n.t("Yes")}
            />
        );
    };

    public render() {
        const { dataSet } = this.props;
        const { campaign, isSaving, confirmClose } = this.state;
        const ConfirmationCloseDialog = this.confirmationCloseDialog;

        const isReady = campaign && !isSaving;
        const title = [i18n.t("Set Target Population"), dataSet.displayName].join(" - ");
        const description = i18n.t(
            `Insert the total population and age distribution (as a percent) for each health site where the campaign will be implemented. This data will be used to calculate coverage rates for the campaign. The source of data may be {{- hyperlink}} or you may have access to local estimates based on population surveys through the Ministry of Health or other stakeholders that would be more updated or reliable. You may overwrite any existing data in HMIS, but please note that any changes you make in this step will only be applied once you run analytics.`,
            {
                hyperlink: "https://hmisocba.msf.es/external-static/Denominators_Tool_OCBA.xlsm",
            }
        );

        return (
            <React.Fragment>
                <Dialog fullWidth={true} maxWidth={"xl"} open={true} onClose={this.requestClose}>
                    <DialogTitle>
                        {title}
                        {!isReady && <LinearProgress style={this.styles.progress} />}
                    </DialogTitle>

                    <DialogContent>
                        {campaign ? (
                            <React.Fragment>
                                <Linkify>{description}</Linkify>
                                <TargetPopulation campaign={campaign} onChange={this.onChange} />
                            </React.Fragment>
                        ) : (
                            i18n.t("Loading...")
                        )}
                    </DialogContent>

                    <DialogActions>
                        <Button onClick={this.requestClose} autoFocus>
                            {i18n.t("Close")}
                        </Button>

                        <Button onClick={this.save} disabled={!isReady}>
                            {isSaving ? i18n.t("Saving...") : i18n.t("Save")}
                        </Button>
                    </DialogActions>
                </Dialog>

                {confirmClose && <ConfirmationCloseDialog />}
            </React.Fragment>
        );
    }
}

export default withSnackbar(TargetPopulationDialog);
