import React from "react";
import PropTypes from "prop-types";
import { Switch, Route } from "react-router-dom";
import CampaignConfigurator from "../campaign-configurator/CampaignConfigurator";
import LandingPage from "./LandingPage";
import CampaignWizard from "../campaign-wizard/CampaignWizard";

class Root extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
    };

    render() {
        const { d2 } = this.props;
        const { REACT_APP_DHIS2_URL } = process.env;
        return (
            <Switch>
                <Route
                    path="/campaign-configurator/new"
                    render={props => <CampaignWizard d2={d2} {...props} />}
                />

                <Route
                    path="/campaign-configurator"
                    render={props => <CampaignConfigurator d2={d2} {...props} />}
                />
                <Route
                    path="/data-entry"
                    component={() => {
                        window.location = `${REACT_APP_DHIS2_URL}/dhis-web-dataentry/index.action`;
                        return null;
                    }}
                />
                <Route
                    path="/dashboard"
                    component={() => {
                        window.location = `${REACT_APP_DHIS2_URL}/dhis-web-dashboard/index.html#/`;
                        return null;
                    }}
                />
                <Route
                    path="/maintenance"
                    component={() => {
                        window.location = `${REACT_APP_DHIS2_URL}/dhis-web-maintenance/index.html`;
                        return null;
                    }}
                />
                <Route render={() => <LandingPage d2={d2} />} />
            </Switch>
        );
    }
}

export default Root;
