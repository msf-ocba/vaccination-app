import React, { SFC } from "react";
import _ from "lodash";

import { withStyles } from "@material-ui/core/styles";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import { createStyles, WithStyles, Theme } from "@material-ui/core";

import i18n from "../../../locales";
import { AntigenDisaggregation } from "../../../models/AntigensDisaggregation";
import SimpleCheckbox from "../../forms/SimpleCheckBox";
import DataElement from "./DataElement";
import { memoize } from "../../../utils/memoize";

type Path = (number | string)[];

interface AntigenSectionProps extends WithStyles<typeof styles> {
    antigen: AntigenDisaggregation;
    antigenCode: string;
    update: (path: Path) => (value: any) => void;
}

interface DisaggregationStepState {
    editPath: Path | null;
}

class AntigenSection extends React.Component<AntigenSectionProps, DisaggregationStepState> {
    state: DisaggregationStepState = {
        editPath: null,
    };

    isEditing = (path: Path): boolean => {
        return _.isEqual(this.state.editPath, path);
    };

    toggleEdit = memoize((path: Path) => () => {
        const editPathUpdated = _.isEqual(this.state.editPath, path) ? null : path;
        this.setState({ editPath: editPathUpdated });
    });

    render() {
        const { antigen, antigenCode, classes, update } = this.props;

        return (
            <Table className={classes.table}>
                <TableHead>
                    <TableRow>
                        <TableCell className={classes.nameTableCell}>{i18n.t("Name")}</TableCell>
                    </TableRow>
                </TableHead>

                <TableBody>
                    {_.flatMap(antigen.dataElements, (dataElement, dataElementIdx) => [
                        <TableRow key={dataElementIdx}>
                            <TableCell component="th" scope="row">
                                <SimpleCheckbox
                                    checked={dataElement.selected}
                                    disabled={!dataElement.optional}
                                    onChange={update([
                                        antigenCode,
                                        "dataElements",
                                        dataElementIdx,
                                        "selected",
                                    ])}
                                    label={dataElement.name}
                                />
                            </TableCell>
                        </TableRow>,

                        dataElement.selected &&
                            !_(dataElement.categories).isEmpty() && (
                                <TableRow key={dataElementIdx + "-dis"}>
                                    <TableCell colSpan={2}>
                                        <DataElement
                                            antigenCode={antigenCode}
                                            dataElementIdx={dataElementIdx}
                                            categories={dataElement.categories}
                                            basePath={[antigenCode, "dataElements", dataElementIdx]}
                                            update={update}
                                            isEditing={this.isEditing}
                                            toggleEdit={this.toggleEdit}
                                        />
                                    </TableCell>
                                </TableRow>
                            ),
                    ])}
                </TableBody>
            </Table>
        );
    }
}

const styles = (_theme: Theme) =>
    createStyles({
        table: {
            minWidth: 700,
        },
        nameTableCell: {
            width: "50%",
            fontSize: "1rem",
        },
    });

export default withStyles(styles)(AntigenSection);
