import React from "react";
import i18n from "@dhis2/d2-i18n";
import PropTypes from "prop-types";
import DialogTitle from "@material-ui/core/DialogTitle";
import Dialog from "@material-ui/core/Dialog";
import { withStyles, DialogContent, DialogActions, Button } from "@material-ui/core";

const styles = theme => ({});

class ConfirmationDialog extends React.Component {
    static propTypes = {
        title: PropTypes.string.isRequired,
        contents: PropTypes.string.isRequired,
        handleConfirm: PropTypes.func.isRequired,
        handleCancel: PropTypes.func.isRequired,
        dialogOpen: PropTypes.bool.isRequired,
    };

    render() {
        const { title, contents, handleConfirm, handleCancel, dialogOpen } = this.props;

        return (
            <React.Fragment>
                <Dialog open={dialogOpen}>
                    <DialogTitle id="simple-dialog-title">{title}</DialogTitle>

                    <DialogContent>{contents}</DialogContent>

                    <DialogActions>
                        <Button onClick={handleConfirm} color="primary">
                            {i18n.t("Ok")}
                        </Button>
                        <Button onClick={handleCancel} color="secondary" autoFocus>
                            {i18n.t("Cancel")}
                        </Button>
                    </DialogActions>
                </Dialog>
            </React.Fragment>
        );
    }
}

export default withStyles(styles)(ConfirmationDialog);
