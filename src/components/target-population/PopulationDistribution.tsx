import React from "react";
import classNames from "classnames";
import _ from "lodash";

import { createStyles, WithStyles, Theme } from "@material-ui/core";
import { Table, TableRow, TableHead, TableCell, TableBody } from "@material-ui/core";
import { withStyles } from "@material-ui/core/styles";

import { memoize } from "../../utils/memoize";
import i18n from "../../locales";
import EditButton from "./EditButton";
import { getShowValue } from "./utils";
import {
    TargetPopulationItem,
    PopulationDistribution,
    TargetPopulation,
} from "../../models/TargetPopulation";
import { OrganisationUnit, OrganisationUnitLevel, Maybe } from "../../models/db.types";
import OrgUnitName from "./OrgUnitName";
import "./PopulationDistribution.css";
import { NumericField } from "../shared/NumericField";
import { Antigen } from "../../models/campaign";

export interface PopulationDistributionProps extends WithStyles<typeof styles> {
    organisationUnitLevels: OrganisationUnitLevel[];
    antigenEditing: Maybe<string>;
    targetPopulation: TargetPopulation;
    populationItem: TargetPopulationItem;
    orgUnitLevel: number;
    onChange: (ageGroup: string, value: number) => void;
    onToggle: (antigenId: string) => void;
}

class PopulationDistributionComponent extends React.Component<PopulationDistributionProps> {
    renderOrgUnit(organisationUnit: OrganisationUnit) {
        const { classes, organisationUnitLevels } = this.props;

        return (
            <TableCell className={classNames(classes.tableOrgUnit, classes.tableHead)}>
                <OrgUnitName
                    organisationUnit={organisationUnit}
                    organisationUnitLevels={organisationUnitLevels}
                />
            </TableCell>
        );
    }

    onChange = memoize((ageGroup: string) => (value: number) => {
        this.props.onChange(ageGroup, value);
    });

    onToggle = memoize((antigenId: string) => () => {
        this.props.onToggle(antigenId);
    });

    setFirstTextField = (input: HTMLElement) => {
        if (input) {
            setTimeout(() => {
                input.focus();
            }, 100);
        }
    };

    renderRow = (props: {
        antigen: Antigen;
        distribution: PopulationDistribution;
        ageGroups: string[];
    }) => {
        const { classes, antigenEditing, targetPopulation } = this.props;
        const { antigen, distribution, ageGroups } = props;
        const isEditing = antigenEditing === antigen.id;

        const orgUnit = distribution.organisationUnit;
        const ageDistribution = targetPopulation.ageDistributionByOrgUnit[orgUnit.id];

        return (
            <TableRow key={orgUnit.id}>
                {this.renderOrgUnit(orgUnit)}

                {ageGroups.map((ageGroup, index) => {
                    const value = ageDistribution ? ageDistribution[ageGroup] : undefined;

                    return (
                        <TableCell key={ageGroup}>
                            {isEditing ? (
                                <NumericField
                                    className={classes.percentageField}
                                    value={value}
                                    onChange={this.onChange(ageGroup)}
                                    inputRef={index === 0 ? this.setFirstTextField : undefined}
                                    maxDecimals={2}
                                />
                            ) : (
                                <span>{getShowValue(ageDistribution[ageGroup]) || "-"}</span>
                            )}
                        </TableCell>
                    );
                })}

                <TableCell>
                    {distribution.isEditable && (
                        <EditButton onClick={this.onToggle(antigen.id)} active={isEditing} />
                    )}
                </TableCell>
            </TableRow>
        );
    };

    public render() {
        const { classes, targetPopulation, populationItem, orgUnitLevel } = this.props;
        const Row = this.renderRow;
        const populationDistribution = populationItem.populationDistributions.find(
            distribution => distribution.organisationUnit.level === orgUnitLevel
        );
        if (!populationDistribution) return null;

        return targetPopulation.antigensDisaggregation.map(({ antigen, ageGroups }) => (
            <div key={antigen.id}>
                <div className={classes.antigenTitleWrapper}>
                    <span className={classes.antigenTitleContent}>{antigen.name}</span>
                </div>

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell className={classes.orgUnitColumn}>
                                {i18n.t("Population distribution (%)")}
                            </TableCell>

                            {ageGroups.map(ageGroup => (
                                <TableCell key={ageGroup} className={classes.tableHead}>
                                    {ageGroup}
                                </TableCell>
                            ))}
                            <TableCell className={classes.tableActions}>{/* Actions */}</TableCell>
                            <TableCell>{/* Right padding */}</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        <Row
                            antigen={antigen}
                            key={antigen.id}
                            distribution={populationDistribution}
                            ageGroups={ageGroups}
                        />

                        <TableRow className={classes.separatorRow}>
                            <TableCell />
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        ));
    }
}

const styles = (_theme: Theme) =>
    createStyles({
        sectionTitle: {
            fontWeight: 410,
        },
        tableOrgUnit: {
            textAlign: "left",
        },
        tableHead: {
            backgroundColor: "#E5E5E5",
            width: "8em",
        },
        tableActions: {
            width: "8em",
        },
        summaryRow: {
            backgroundColor: "#EEE",
        },
        percentageField: {
            width: "3em",
        },
        separatorRow: {
            height: 24,
        },
        antigenTitleWrapper: {
            textAlign: "center",
            margin: 15,
        },
        antigenTitleContent: {
            color: "#619de7",
            padding: 10,
            backgroundColor: "#E5E5E5",
            fontSize: "1.2em",
            fontWeight: "bold",
        },
        orgUnitColumn: {
            width: "20vw",
        },
    });

export default withStyles(styles)(PopulationDistributionComponent);
