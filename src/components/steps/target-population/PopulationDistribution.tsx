import React from "react";
import classNames from "classnames";
import _ from "lodash";

import { createStyles, WithStyles, Theme, TextField } from "@material-ui/core";
import { Table, TableRow, TableHead, TableCell, TableBody } from "@material-ui/core";
import { withStyles } from "@material-ui/core/styles";

import { memoize } from "../../../utils/memoize";
import i18n from "../../../locales";
import EditButton from "./EditButton";
import { getShowValue } from "./utils";
import Value from "./Value";
import {
    TargetPopulationItem,
    getFinalPopulationDistribution,
    PopulationDistribution,
} from "../../../models/TargetPopulation";
import { OrganisationUnit, OrganisationUnitLevel, Maybe } from "../../../models/db.types";
import OrgUnitName from "./OrgUnitName";
import "./PopulationDistribution.css";

export interface PopulationDistributionProps extends WithStyles<typeof styles> {
    organisationUnitLevels: OrganisationUnitLevel[];
    rowEditing: Maybe<number>;
    ageGroups: string[];
    targetPopOu: TargetPopulationItem;
    onChange: (rowIndex: number, ageGroup: string, value: number) => void;
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

    onChange = memoize(
        (distributionIdx: number, ageGroup: string) => (
            ev: React.ChangeEvent<HTMLInputElement>
        ) => {
            const value = ev.currentTarget.value;
            this.props.onChange(distributionIdx, ageGroup, parseFloat(value));
        }
    );

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
        const { classes, rowEditing, ageGroups } = this.props;
        const { distribution, distributionIdx } = props;
        const isEditing = rowEditing === distributionIdx;

        return (
            <TableRow key={distribution.organisationUnit.id}>
                {this.renderOrgUnit(distribution.organisationUnit)}

                {ageGroups.map((ageGroup, index) => (
                    <TableCell key={ageGroup}>
                        {isEditing ? (
                            <TextField
                                className={classes.percentageField}
                                value={getShowValue(distribution.ageDistribution[ageGroup])}
                                onChange={this.onChange(distributionIdx, ageGroup)}
                                inputRef={index === 0 ? this.setFirstTextField : undefined}
                                type="number"
                            />
                        ) : (
                            <span>
                                {getShowValue(distribution.ageDistribution[ageGroup]) || "-"}
                            </span>
                        )}
                    </TableCell>
                ))}

                <TableCell>
                    {distribution.isEditable && (
                        <EditButton onClick={this.onToggle(distributionIdx)} active={isEditing} />
                    )}
                </TableCell>
            </TableRow>
        );
    };
    public render() {
        const { classes, ageGroups, targetPopOu } = this.props;
        const Row = this.renderRow;
        const populationByAge = getFinalPopulationDistribution(ageGroups, targetPopOu);

        return (
            <React.Fragment>
                <div className={classes.sectionTitle}>{i18n.t("Population distribution (%)")}</div>

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell />
                            {ageGroups.map(ageGroup => (
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

                            {ageGroups.map(ageGroup => (
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
