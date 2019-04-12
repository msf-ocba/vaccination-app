import React from "react";
import PropTypes from "prop-types";
import { Switch, Route } from "react-router-dom";

import CampaignConfigurator from "../campaign-configurator/CampaignConfigurator";
import DataEntry from "../data-entry/DataEntry";
import Dashboard from "../dashboard/Dashboard";
import LandingPage from "./LandingPage";
import CampaignWizard from "../campaign-wizard/CampaignWizard";
import { getMetadataConfig } from "../../models/config";
import DbD2 from "../../models/db-d2";

class Root extends React.Component {
    state = {
        config: null,
    };

    static propTypes = {
        d2: PropTypes.object.isRequired,
    };

    async componentDidMount() {
        const config = await getMetadataConfig(new DbD2(this.props.d2));

        this.setState({
            config: config,
        });
    }

    render() {
        const { d2 } = this.props;
        if (!this.state.config) return null;

        return (
            <Switch>
                <Route
                    path="/campaign-configuration/new"
                    render={props => (
                        <CampaignWizard d2={d2} config={this.state.config} {...props} />
                    )}
                />

                <Route
                    path="/campaign-configuration"
                    render={props => (
                        <CampaignConfigurator d2={d2} config={this.state.config} {...props} />
                    )}
                />

                <Route
                    path="/data-entry/:id"
                    render={props => <DataEntry d2={d2} config={this.state.config} {...props} />}
                />

                <Route
                    path="/dashboard/:id"
                    render={props => <Dashboard d2={d2} config={this.state.config} {...props} />}
                />

                <Route render={() => <LandingPage d2={d2} />} />
            </Switch>
        );
    }
}

export default Root;
