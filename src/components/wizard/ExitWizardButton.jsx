import React from "react";
import PropTypes from "prop-types";
import { ConfirmationDialog } from "d2-ui-components";
import i18n from "@dhis2/d2-i18n";

class ExitWizardButton extends React.Component {
    static propTypes = {
        isOpen: PropTypes.bool,
        onConfirm: PropTypes.func.isRequired,
        onCancel: PropTypes.func.isRequired,
    };
    render() {
        const { isOpen, onCancel, onConfirm } = this.props;

        if (!isOpen) return null;

        return (
            <ConfirmationDialog
                isOpen={true}
                onSave={onConfirm}
                onCancel={onCancel}
                title={i18n.t("Cancel Campaign Creation?")}
                description={i18n.t(
                    "You are about to exit the campaign creation wizard. All your changes will be lost. Are you sure?"
                )}
                saveText={i18n.t("Yes")}
            />
        );
    }
}

export default ExitWizardButton;
