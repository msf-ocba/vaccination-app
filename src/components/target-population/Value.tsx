import React from "react";
import _ from "lodash";
import classNames from "classnames";

import i18n from "../../locales";
import { WithStyles, Theme, createStyles } from "@material-ui/core";
import { withStyles } from "@material-ui/core/styles";

export interface ValueProps extends WithStyles<typeof styles> {
    value: number | string | undefined;
    className?: string;
}

class Value extends React.Component<ValueProps> {
    public render() {
        const { classes, className, value } = this.props;
        const isMissing = _.isUndefined(value) || value === "";

        return isMissing ? (
            <span className={classNames(classes.missing, className)}>{i18n.t("Missing")}</span>
        ) : (
            <span className={className}>{value}</span>
        );
    }
}

const styles = (theme: Theme) =>
    createStyles({
        missing: {
            color: theme.palette.error.light,
            textTransform: "uppercase",
        },
    });

export default withStyles(styles)(Value);
