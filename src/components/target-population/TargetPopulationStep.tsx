import React from "react";
import _ from "lodash";

import { withStyles } from "@material-ui/core/styles";
import {
    createStyles,
    WithStyles,
    Theme,
    Card,
    CardContent,
    ExpansionPanel,
    ExpansionPanelSummary,
    ExpansionPanelDetails,
    Typography,
    MuiThemeProvider,
} from "@material-ui/core";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";

import { memoize } from "../../utils/memoize";
import { D2 } from "../../models/d2.types";
import Campaign from "../../models/campaign";
import { Maybe } from "../../models/db.types";
import TotalPopulation from "./TotalPopulation";
import { createMuiThemeOverrides } from "../../utils/styles";
import PopulationDistribution from "./PopulationDistribution";
import { getFullOrgUnitName } from "../../models/organisation-units";

export interface AgeGroupRow {
    ouIndex: number;
    distributionIdx: number;
}

interface TargetPopulationProps extends WithStyles<typeof styles> {
    d2: D2;
    campaign: Campaign;
    onChange: (campaign: Campaign) => void;
}

interface TargetPopulationState {
    editPopulation: Maybe<number>;
    editAgeGroupRow: Maybe<AgeGroupRow>;
}

class TargetPopulationComponent extends React.Component<
    TargetPopulationProps,
    TargetPopulationState
> {
    state: TargetPopulationState = {
        editPopulation: undefined,
        editAgeGroupRow: undefined,
    };

    async componentDidMount() {
        const { campaign, onChange } = this.props;
        onChange(await campaign.withTargetPopulation());
    }

    onTotalPopulationChange = memoize(
        (ouIndex: number) => (ev: React.ChangeEvent<HTMLInputElement>) => {
            const { campaign, onChange } = this.props;
            if (!campaign.targetPopulation) return;

            const value = ev.currentTarget.value;
            const campaignUpdated = campaign.setTargetPopulation(
                campaign.targetPopulation.setTotalPopulation(ouIndex, parseInt(value))
            );
            onChange(campaignUpdated);
        }
    );

    onTotalPopulationToggle = memoize((ouIndex: number) => () => {
        const { editPopulation } = this.state;
        this.setState({ editPopulation: editPopulation === ouIndex ? undefined : ouIndex });
    });

    onAgeGroupPopulationChange = memoize(
        (ouIndex: number) => (orgUnitId: string, ageGroup: string, value: number) => {
            const { campaign, onChange } = this.props;
            if (!campaign.targetPopulation) return;
            const ageGroupSelector = { orgUnitId, ageGroup };

            const campaignUpdated = campaign.setTargetPopulation(
                campaign.targetPopulation.setAgeGroupPopulation(ageGroupSelector, value)
            );
            onChange(campaignUpdated);
        }
    );

    onAgeGroupPopulationToggle = memoize((ouIndex: number) => (distributionIdx: number) => {
        const { editAgeGroupRow } = this.state;
        const ageGroupRow = { ouIndex, distributionIdx };
        this.setState({
            editAgeGroupRow: _.isEqual(editAgeGroupRow, ageGroupRow) ? undefined : ageGroupRow,
        });
    });

    render() {
        const { classes, campaign } = this.props;
        const { editPopulation, editAgeGroupRow } = this.state;
        const { targetPopulation } = campaign;

        if (!targetPopulation) return null;

        const { organisationUnitLevels } = targetPopulation;

        return (
            <MuiThemeProvider theme={muiTheme}>
                {targetPopulation.targetPopulationList.map((targetPopOu, ouIndex) => (
                    <ExpansionPanel key={targetPopOu.organisationUnit.id} defaultExpanded={true}>
                        <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography className={classes.expansionPanelHeading}>
                                {getFullOrgUnitName(targetPopOu.organisationUnit)}
                            </Typography>
                        </ExpansionPanelSummary>

                        <ExpansionPanelDetails className={classes.panelDetails}>
                            <Card className={classes.card} test-total-population={ouIndex}>
                                <CardContent>
                                    <TotalPopulation
                                        organisationUnitLevels={organisationUnitLevels}
                                        isEditing={editPopulation === ouIndex}
                                        targetPopOu={targetPopOu}
                                        onChange={this.onTotalPopulationChange(ouIndex)}
                                        onToggle={this.onTotalPopulationToggle(ouIndex)}
                                    />
                                </CardContent>
                            </Card>

                            <Card className={classes.card} test-population-distribution={ouIndex}>
                                <CardContent>
                                    <PopulationDistribution
                                        organisationUnitLevels={organisationUnitLevels}
                                        rowEditing={
                                            editAgeGroupRow && editAgeGroupRow.ouIndex == ouIndex
                                                ? editAgeGroupRow.distributionIdx
                                                : undefined
                                        }
                                        targetPopulation={targetPopulation}
                                        targetPopOu={targetPopOu}
                                        onChange={this.onAgeGroupPopulationChange(ouIndex)}
                                        onToggle={this.onAgeGroupPopulationToggle(ouIndex)}
                                    />
                                </CardContent>
                            </Card>
                        </ExpansionPanelDetails>
                    </ExpansionPanel>
                ))}
            </MuiThemeProvider>
        );
    }
}

const styles = (theme: Theme) =>
    createStyles({
        card: {
            margin: "15px 0px",
        },
        tableHead: {
            backgroundColor: "#E5E5E5",
        },
        tableCell: {},
        value: {
            marginLeft: 10,
            fontSize: "1.1em",
        },
        populationField: {
            marginLeft: 10,
            marginTop: 7,
            width: "5em",
        },
        expansionPanelHeading: {
            flexBasis: "100%",
            flexShrink: 0,
            fontSize: "1.15em",
            fontWeight: 500,
        },
        panelDetails: {
            display: "block",
        },
    });

const muiTheme = createMuiThemeOverrides({
    MuiTableCell: {
        root: {
            padding: "5px 5px 5px 5px",
            textAlign: "center",
        },
        body: {
            fontSize: "0.9em",
        },
        head: {
            fontSize: "0.9em",
        },
    },
});

export default withStyles(styles)(TargetPopulationComponent);
