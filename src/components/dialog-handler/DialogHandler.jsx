import React from "react";
import i18n from "@dhis2/d2-i18n";
import PropTypes from "prop-types";
import DialogTitle from "@material-ui/core/DialogTitle";
import Dialog from "@material-ui/core/Dialog";
import { withStyles, DialogContent, DialogActions, Button } from "@material-ui/core";

const styles = theme => ({});

class DialogHandler extends React.Component {
    static propTypes = {
        buttonComponent: PropTypes.func.isRequired,
        title: PropTypes.string.isRequired,
        contents: PropTypes.string.isRequired,
    };

    state = {
        isOpen: false,
    };

    handleClickOpen = () => {
        this.setState({ isOpen: true });
    };

    handleClose = () => {
        this.setState({ isOpen: false });
    };

    render() {
        const { buttonComponent: CustomButton, title, contents, classes } = this.props;
        const { isOpen } = this.state;

        return (
            <React.Fragment>
                <CustomButton onClick={this.handleClickOpen} />

                <Dialog open={isOpen} onClose={this.handleClose} className={classes.dialog}>
                    <DialogTitle id="simple-dialog-title">{title}</DialogTitle>

                    <DialogContent>{contents}</DialogContent>

                    <DialogActions>
                        <Button onClick={this.handleClose} color="primary" autoFocus>
                            {i18n.t("Close")}
                        </Button>
                    </DialogActions>
                </Dialog>
            </React.Fragment>
        );
    }
}

export default withStyles(styles)(DialogHandler);
