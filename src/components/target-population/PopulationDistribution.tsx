import React from "react";
import classNames from "classnames";
import _ from "lodash";

import { createStyles, WithStyles, Theme } from "@material-ui/core";
import { Table, TableRow, TableHead, TableCell, TableBody } from "@material-ui/core";
import { withStyles } from "@material-ui/core/styles";

import { memoize } from "../../utils/memoize";
import i18n from "../../locales";
import EditButton from "./EditButton";
import { getValue, getShowValue } from "./utils";
import Value from "./Value";
import {
    TargetPopulationItem,
    PopulationDistribution,
    TargetPopulation,
} from "../../models/TargetPopulation";
import { OrganisationUnit, OrganisationUnitLevel, Maybe } from "../../models/db.types";
import OrgUnitName from "./OrgUnitName";
import "./PopulationDistribution.css";
import { NumericField } from "../shared/NumericField";

export interface PopulationDistributionProps extends WithStyles<typeof styles> {
    organisationUnitLevels: OrganisationUnitLevel[];
    rowEditing: Maybe<number>;
    targetPopulation: TargetPopulation;
    targetPopOu: TargetPopulationItem;
    onChange: (orgUnitId: string, ageGroup: string, value: number) => void;
    onToggle: (rowIndex: number) => void;
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

    onChange = memoize((orgUnitId: string, ageGroup: string) => (value: number) => {
        this.props.onChange(orgUnitId, ageGroup, value);
    });

    onToggle = memoize((distributionIdx: number) => () => {
        this.props.onToggle(distributionIdx);
    });

    setFirstTextField = (input: HTMLElement) => {
        if (input) {
            setTimeout(() => {
                input.focus();
            }, 100);
        }
    };

    renderRow = (props: { distribution: PopulationDistribution; distributionIdx: number }) => {
        const { classes, rowEditing, targetPopulation } = this.props;
        const { distribution, distributionIdx } = props;
        const isEditing = rowEditing === distributionIdx;
        const { ageGroups } = targetPopulation;
        const orgUnit = distribution.organisationUnit;
        const ageDistribution = targetPopulation.ageDistributionByOrgUnit[orgUnit.id];

        return (
            <TableRow key={orgUnit.id}>
                {this.renderOrgUnit(orgUnit)}

                {ageGroups.map((ageGroup, index) => {
                    const value = ageDistribution ? getValue(ageDistribution[ageGroup]) : undefined;

                    return (
                        <TableCell key={ageGroup}>
                            {isEditing ? (
                                <NumericField
                                    className={classes.percentageField}
                                    value={value}
                                    onChange={this.onChange(orgUnit.id, ageGroup)}
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
                        <EditButton onClick={this.onToggle(distributionIdx)} active={isEditing} />
                    )}
                </TableCell>
            </TableRow>
        );
    };
    public render() {
        const { classes, targetPopulation, targetPopOu } = this.props;
        const Row = this.renderRow;
        const populationByAge = targetPopulation.getFinalDistribution(targetPopOu);

        return (
            <React.Fragment>
                <div className={classes.sectionTitle}>{i18n.t("Population distribution (%)")}</div>

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell />
                            {targetPopulation.ageGroups.map(ageGroup => (
                                <TableCell key={ageGroup} className={classes.tableHead}>
                                    {ageGroup}
                                </TableCell>
                            ))}
                            <TableCell>{/* Actions */}</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {targetPopOu.populationDistributions.map(
                            (distribution, distributionIdx) => (
                                <Row
                                    key={distributionIdx}
                                    distribution={distribution}
                                    distributionIdx={distributionIdx}
                                />
                            )
                        )}

                        <TableRow className={classes.separatorRow}>
                            <TableCell />
                        </TableRow>

                        <TableRow className={classes.summaryRow}>
                            <TableCell
                                className={classNames(classes.tableOrgUnit, classes.tableHead)}
                            >
                                {i18n.t("Campaign Population Distribution")}
                            </TableCell>

                            {targetPopulation.ageGroups.map(ageGroup => (
                                <TableCell key={ageGroup}>
                                    <Value value={populationByAge[ageGroup]} />
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableBody>
                </Table>
            </React.Fragment>
        );
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
    });

export default withStyles(styles)(PopulationDistributionComponent);
