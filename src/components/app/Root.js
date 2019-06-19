import React from "react";
import PropTypes from "prop-types";
import { Switch, Route } from "react-router-dom";

import CampaignConfiguration from "../campaign-configuration/CampaignConfiguration";
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

    constructor(props) {
        super(props);
        this.db = new DbD2(props.d2);
    }

    async componentDidMount() {
        const config = await getMetadataConfig(this.db);

        this.setState({
            config: config,
        });
    }

    render() {
        const { d2 } = this.props;
        const { config } = this.state;
        const { db } = this;
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
                    render={props => <Dashboard d2={d2} config={config} {...props} />}
                />

                <Route render={() => <LandingPage d2={d2} />} />
            </Switch>
        );
    }
}

export default Root;
