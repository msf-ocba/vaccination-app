import React from "react";
import _ from "lodash";

import { withStyles } from "@material-ui/core/styles";
import { createStyles, WithStyles, Theme } from "@material-ui/core";
import { MuiThemeProvider } from "@material-ui/core";

import { D2 } from "../../../models/d2.types";
import Campaign, { Antigen } from "../../../models/campaign";
import { memoize } from "../../../utils/memoize";
import { createMuiThemeOverrides } from "../../../utils/styles";
import AntigenSection from "./AntigenSection";

const { Sidebar } = require("@dhis2/d2-ui-core"); // Untyped

type Path = (number | string)[];

interface DisaggregationStepProps extends WithStyles<typeof styles> {
    d2: D2;
    campaign: Campaign;
    onChange: (campaign: Campaign) => void;
}

interface DisaggregationStepState {
    currentAntigen: Antigen | null;
}

class DisaggregationStep extends React.Component<DisaggregationStepProps, DisaggregationStepState> {
    state: DisaggregationStepState = {
        currentAntigen: this.props.campaign.antigens[0],
    };

    update = memoize((path: Path) => (newValue: any) => {
        const { campaign, onChange } = this.props;
        const disaggregationDataUpdated = campaign.antigensDisaggregation.set(path, newValue);
        const campaignUpdated = campaign.setAntigensDisaggregation(disaggregationDataUpdated);
        onChange(campaignUpdated);
    });

    changeSection = (antigenCode: string): void => {
        const antigen = _(this.props.campaign.antigens)
            .keyBy("code")
            .get(antigenCode);
        this.setState({ currentAntigen: antigen });
    };

    render() {
        const { classes, campaign } = this.props;
        const { currentAntigen } = this.state;
        if (!currentAntigen) return null;

        const antigenDisaggregation = campaign.antigensDisaggregation;
        const currentAntigenDisaggregation = antigenDisaggregation.forAntigen(currentAntigen);
        const sections = campaign.antigens.map(antigen => ({
            label: antigen.name,
            key: antigen.code,
        }));

        if (_(sections).isEmpty() || !currentAntigenDisaggregation) return null;

        return (
            <MuiThemeProvider theme={materialTheme}>
                <div className={classes.box}>
                    <div className={classes.leftBar}>
                        <Sidebar sections={sections} onChangeSection={this.changeSection} />
                    </div>

                    <div className={classes.page}>
                        <AntigenSection
                            antigen={currentAntigenDisaggregation}
                            antigenCode={currentAntigen.code}
                            update={this.update}
                        />
                    </div>
                </div>
            </MuiThemeProvider>
        );
    }
}

const styles = (_theme: Theme) =>
    createStyles({
        box: {
            position: "relative",
            width: "auto",
            height: "auto",
            margin: 16,
            boxShadow: "rgba(0, 0, 0, 0.12) 0px 1px 6px, rgba(0, 0, 0, 0.12) 0px 1px 4px",
            paddingRight: 20
        },
        leftBar: {
            position: "absolute",
            height: "100%",
        },
        page: {
            paddingLeft: 295 + 8,
        },
    });

const materialTheme = createMuiThemeOverrides({
    MuiFormControlLabel: {
        label: {
            "&$disabled": {
                color: "#000",
            }
        },
    },
    MuiCheckbox: {
        colorSecondary: {
            "&$disabled": {
                color: "#444",
            },
        },
    },
    MuiTableCell: {
        root: {
            borderBottom: "1px solid #e0e0e0",
        },
    },
});

export default withStyles(styles)(DisaggregationStep);
