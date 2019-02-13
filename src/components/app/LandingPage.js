import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";
import Paper from "@material-ui/core/Paper";
import FontIcon from "material-ui/FontIcon";
import GridList from "@material-ui/core/GridList";
import GridListTile from "@material-ui/core/GridListTile";
import { withStyles } from "@material-ui/core/styles";
import { Link } from "react-router-dom";

const lightGray = "#7a7a7a";
const styles = theme => ({
    root: {
        display: "flex",
        justifyContent: "center",
    },
    paper: {
        width: "90%",
        padding: 10,
    },
    gridTile: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
        "&:hover": {
            backgroundColor: "#f9f9f9",
        },
    },
    tileContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        height: "100%",
        paddingTop: 40,
        boxSizing: "border-box",
        color: lightGray,
    },
    title: {
        fontSize: 20,
    },
});

class LandingPage extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
    };

    onClick = key => {
        console.log("TODO", "clicked", key);
    };

    render() {
        const { classes } = this.props;
        const items = [
            ["campaign-configurator", i18n.t("Campaign Configurator"), "edit"],
            ["data-entry", i18n.t("Data Entry"), "library_books"],
            ["dashboard", i18n.t("Dashboard"), "dashboard"],
            ["maintenance", i18n.t("Maintenance"), "settings"],
        ];
        const menuItems = items.map(([key, title, icon]) => (
            <GridListTile
                key={key}
                data-test={`page-${key}`}
                onClick={this.onClick.bind(this, key)}
                component={Link}
                to={`/${key}`}
                className={classes.gridTile}
            >
                <div className={classes.tileContainer}>
                    <FontIcon
                        className="material-icons"
                        style={{ fontSize: 60, marginBottom: 20, color: lightGray }}
                    >
                        {icon}
                    </FontIcon>
                    <div className={classes.title}>{title}</div>
                </div>
            </GridListTile>
        ));

        return (
            <div className={classes.root}>
                <Paper className={classes.paper}>
                    <GridList data-test="pages" cols={2}>
                        {menuItems}
                    </GridList>
                </Paper>
            </div>
        );
    }
}

export default withStyles(styles)(LandingPage);
