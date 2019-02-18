import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";
import Paper from "@material-ui/core/Paper";
import FontIcon from "material-ui/FontIcon";
import MenuItem from "@material-ui/core/MenuItem";
import MenuList from "@material-ui/core/MenuList";
import { withStyles } from "@material-ui/core/styles";
import { Link } from "react-router-dom";

const styles = _theme => ({
    root: {
        display: "flex",
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
            <MenuItem
                key={key}
                data-test={`page-${key}`}
                onClick={this.onClick.bind(this, key)}
                component={Link}
                to={`/${key}`}
            >
                <FontIcon className="material-icons">{icon}</FontIcon>
                {title}
            </MenuItem>
        ));

        return (
            <div className={classes.root}>
                <Paper>
                    <MenuList data-test="pages">{menuItems}</MenuList>
                </Paper>
            </div>
        );
    }
}

export default withStyles(styles)(LandingPage);
