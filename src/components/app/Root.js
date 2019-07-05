import React from "react";
import PropTypes from "prop-types";
import { Switch, Route } from "react-router-dom";

import CampaignConfiguration from "../campaign-configuration/CampaignConfiguration";
import DataEntry from "../data-entry/DataEntry";
import Dashboard from "../dashboard/Dashboard";
import LandingPage from "./LandingPage";
import CampaignWizard from "../campaign-wizard/CampaignWizard";

class Root extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
        db: PropTypes.object.isRequired,
    };

    render() {
        const { d2, config, db } = this.props;
        if (!config) return null;

        return (
            <Switch>
                <Route
                    path="/campaign-configuration/new"
                    render={props => <CampaignWizard d2={d2} db={db} config={config} {...props} />}
                />

                <Route
                    path="/campaign-configuration/edit/:id"
                    render={props => <CampaignWizard d2={d2} db={db} config={config} {...props} />}
                />

                <Route
                    path="/campaign-configuration"
                    render={props => (
                        <CampaignConfiguration d2={d2} db={db} config={config} {...props} />
                    )}
                />

                <Route
                    path="/data-entry/:id?"
                    render={props => <DataEntry d2={d2} config={config} {...props} />}
                />

                <Route
                    path="/dashboard/:id?"
                    render={props => <Dashboard d2={d2} db={db} config={config} {...props} />}
                />

                <Route render={() => <LandingPage d2={d2} />} />
            </Switch>
        );
    }
}

export default Root;
