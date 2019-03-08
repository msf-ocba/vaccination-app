import React from "react";
import PropTypes from "prop-types";
import { Switch, Route } from "react-router-dom";
import CampaignConfigurator from "../campaign-configurator/CampaignConfigurator";
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
        const { REACT_APP_DHIS2_BASE_URL } = process.env;
        if (!this.state.config) return null;

        return (
            <Switch>
                <Route
                    path="/campaign-configurator/new"
                    render={props => (
                        <CampaignWizard d2={d2} config={this.state.config} {...props} />
                    )}
                />

                <Route
                    path="/campaign-configurator"
                    render={props => <CampaignConfigurator d2={d2} {...props} />}
                />
                <Route
                    path="/data-entry"
                    component={() => {
                        window.location = `${REACT_APP_DHIS2_BASE_URL}/dhis-web-dataentry/index.action`;
                        return null;
                    }}
                />
                <Route
                    path="/dashboard"
                    component={() => {
                        window.location = `${REACT_APP_DHIS2_BASE_URL}/dhis-web-dashboard/index.html`;
                        return null;
                    }}
                />
                <Route
                    path="/maintenance"
                    component={() => {
                        window.location = `${REACT_APP_DHIS2_BASE_URL}/dhis-web-maintenance/index.html`;
                        return null;
                    }}
                />
                <Route render={() => <LandingPage d2={d2} />} />
            </Switch>
        );
    }
}

export default Root;
