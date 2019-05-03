import React from "react";
import PropTypes from "prop-types";
import _ from "lodash";
import memoize from "nano-memoize";
import i18n from "@dhis2/d2-i18n";
import { withStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Stepper from "@material-ui/core/Stepper";
import Step from "@material-ui/core/Step";
import StepButton from "@material-ui/core/StepButton";
import Button from "@material-ui/core/Button";
import { IconButton } from "@material-ui/core";
import Icon from "@material-ui/core/Icon";
import { DialogButton, withSnackbar } from "d2-ui-components";

const styles = theme => ({
    root: {
        width: "100%",
    },
    description: {
        marginBottom: 15,
        marginLeft: 3,
        fontSize: "1.1em",
    },
    button: {
        margin: theme.spacing.unit,
        marginRight: 5,
        padding: 10,
    },
    buttonDisabled: {
        color: "grey !important",
    },
    buttonContainer: {
        display: "flex",
        justifyContent: "flex-end",
        paddingTop: 10,
    },
    stepButton: {
        width: "auto",
    },
    contents: {
        margin: 10,
        padding: 25,
    },
    messages: {
        padding: 0,
        listStyleType: "none",
        color: "red",
    },
    stepper: {
        marginLeft: 10,
        marginRight: 10,
    },
});

class Wizard extends React.Component {
    state = {
        currentStepKey: this.props.initialStepKey,
        lastClickableStepIndex: this.props.lastClickableStepIndex || 0,
        messages: [],
    };

    static propTypes = {
        initialStepKey: PropTypes.string.isRequired,
        onStepChangeRequest: PropTypes.func.isRequired,
        useSnackFeedback: PropTypes.bool,
        snackbar: PropTypes.object.isRequired,
        steps: PropTypes.arrayOf(
            PropTypes.shape({
                key: PropTypes.string.isRequired,
                label: PropTypes.string.isRequired,
                component: PropTypes.func.isRequired,
            })
        ).isRequired,
        lastClickableStepIndex: PropTypes.number,
    };

    static defaultProps = {
        useSnackFeedback: false,
        lastClickableStepIndex: 0,
    };

    getAdjacentSteps = () => {
        const { steps } = this.props;
        const { currentStepKey } = this.state;
        const index = _(steps).findIndex(step => step.key === currentStepKey);
        const prevStepKey = index >= 1 ? steps[index - 1].key : null;
        const nextStepKey = index >= 0 && index < steps.length - 1 ? steps[index + 1].key : null;
        return { prevStepKey, nextStepKey };
    };

    nextStep = () => {
        const { nextStepKey } = this.getAdjacentSteps();
        this.setStep(nextStepKey);
    };

    prevStep = () => {
        const { prevStepKey } = this.getAdjacentSteps();
        this.setStep(prevStepKey);
    };

    renderNavigationButton = ({ stepKey, onClick, label }) => {
        return (
            <Button
                variant="contained"
                classes={{ disabled: this.props.classes.buttonDisabled }}
                disabled={!stepKey}
                className={this.props.classes.button}
                onClick={onClick}
            >
                {label}
            </Button>
        );
    };

    setStep = newStepKey => {
        const { currentStepKey, lastClickableStepIndex } = this.state;
        const { onStepChangeRequest, steps } = this.props;
        const stepsByKey = _.keyBy(steps, "key");
        const newStep = stepsByKey[newStepKey];
        const currentStep = stepsByKey[currentStepKey];
        const currentStepIndex = _(steps).findIndex(step => step.key === currentStepKey);
        const newStepIndex = _(steps).findIndex(step => step.key === newStepKey);
        const shouldValidate = newStepIndex > currentStepIndex;
        const errorMessages = shouldValidate ? onStepChangeRequest(currentStep, newStep) : [];

        if (_(errorMessages).isEmpty()) {
            const newLastClickableStepIndex = Math.max(lastClickableStepIndex, newStepIndex);
            this.setState({
                currentStepKey: newStepKey,
                lastClickableStepIndex: newLastClickableStepIndex,
                messages: [],
            });
        } else {
            if (this.props.useSnackFeedback) {
                this.props.snackbar.error(errorMessages.join("\n"), {
                    autoHideDuration: null,
                });
            } else {
                this.setState({ messages: errorMessages });
            }
        }
    };

    onStepClicked = memoize(stepKey => () => {
        this.setStep(stepKey);
    });

    renderHelp = ({ step }) => {
        const Button = ({ onClick }) => (
            <IconButton tooltip={i18n.t("Help")} onClick={onClick}>
                <Icon color="primary">help</Icon>
            </IconButton>
        );

        return (
            <DialogButton
                buttonComponent={Button}
                title={`${step.label} - ${i18n.t("Help")}`}
                contents={step.help}
            />
        );
    };

    renderFeedbackMessages = () => {
        const { classes, useSnackFeedback } = this.props;
        const { messages } = this.state;

        if (useSnackFeedback || messages.length === 0) {
            return null;
        } else {
            return (
                <div className="messages">
                    <ul className={classes.messages}>
                        {messages.map((message, index) => (
                            <li key={index}>{message}</li>
                        ))}
                    </ul>
                </div>
            );
        }
    };

    render() {
        const { classes, steps } = this.props;
        const { currentStepKey, lastClickableStepIndex } = this.state;
        const index = _(steps).findIndex(step => step.key === currentStepKey);
        const currentStepIndex = index >= 0 ? index : 0;
        const currentStep = steps[currentStepIndex];
        const { prevStepKey, nextStepKey } = this.getAdjacentSteps();
        const NavigationButton = this.renderNavigationButton;
        const Help = this.renderHelp;
        const FeedbackMessages = this.renderFeedbackMessages;

        return (
            <div className={classes.root}>
                <Stepper nonLinear={true} activeStep={currentStepIndex} className={classes.stepper}>
                    {steps.map((step, index) => (
                        <Step
                            key={step.key}
                            completed={false}
                            disabled={index > lastClickableStepIndex}
                        >
                            <StepButton
                                key={step.key}
                                data-test-current={currentStep === step}
                                onClick={this.onStepClicked(step.key)}
                                classes={{ root: classes.stepButton }}
                            >
                                {step.label}
                            </StepButton>

                            {step.help && step === currentStep ? <Help step={step} /> : null}
                        </Step>
                    ))}
                </Stepper>

                <FeedbackMessages />

                <Paper className={classes.contents} data-wizard-contents={true}>
                    {currentStep.description && (
                        <div className={classes.description}>{currentStep.description}.</div>
                    )}
                    {<currentStep.component {...currentStep.props} />}
                    <div className={classes.buttonContainer}>
                        <NavigationButton
                            stepKey={prevStepKey}
                            onClick={this.prevStep}
                            label={"← " + i18n.t("Previous")}
                        />

                        <NavigationButton
                            stepKey={nextStepKey}
                            onClick={this.nextStep}
                            label={i18n.t("Next") + " →"}
                        />
                    </div>
                </Paper>
            </div>
        );
    }
}

export default withSnackbar(withStyles(styles)(Wizard));
