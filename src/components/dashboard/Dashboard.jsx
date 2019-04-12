import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";
import { withSnackbar } from "d2-ui-components";
import ReactDOM from "react-dom";

import PageHeader from "../shared/PageHeader";
import { getDatasetById, getDashboardId } from "../../models/datasets";

class Dashboard extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
        config: PropTypes.object.isRequired,
    };


    state = {
        iFrameSrc: ""
    };

    async componentDidMount() {
        const dashboardURL = await this.getDashboardURL();
        console.log(dashboardURL)
        this.setState({ iFrameSrc: dashboardURL });
    }

    componentDidUpdate() {
        const { iFrameSrc } = this.state;
        if (iFrameSrc){
            let iframe = ReactDOM.findDOMNode(this.refs.iframe);
            iframe.addEventListener("load", this.setDashboardStyling.bind(this, iframe));
        }
    }

    waitforDashboardToLoad(iframeDocument) {
        return new Promise(resolve => {
            var check = () => {
                if (iframeDocument.querySelector(`.app-wrapper`)) {
                    resolve();
                } else {
                    setTimeout(check, 1000);
                }
            };

            check();
        });
    }

    async setDashboardStyling(iframe) {
        const iframeDocument = iframe.contentWindow.document;

        await this.waitforDashboardToLoad(iframeDocument)
        let iFrameRoot = iframeDocument.querySelector(`#root`)
        iFrameRoot.style.marginTop = "-110px";
        let iFrameWrapper = iframeDocument.querySelector(`.app-wrapper`)
        iFrameWrapper.removeChild(iFrameWrapper.firstChild).remove();
        iFrameWrapper.removeChild(iFrameWrapper.firstChild).remove();
    }

    backCampaignConfigurator = () => {
        this.props.history.push("/campaign-configuration");
    };

    async getDashboardURL() {
        const {
            d2,
            match: { params },
            config
        } = this.props;
        const dataSet = await getDatasetById(params.id, d2)
        const dashboardId = getDashboardId(dataSet, config);
        if (dashboardId) {
            return `/dhis-web-dashboard/#/${dashboardId}`;
        } else {
            this.props.snackbar.error(i18n.t("Cannot find dashboard associated to the campaign"));
        }
    };

    render() {

        const { iFrameSrc } = this.state;
        return (
            <React.Fragment>
                <PageHeader
                    title={i18n.t("Dashboard")}
                    onBackClick={this.backCampaignConfigurator}
                />
                <div>
                    {iFrameSrc && <iframe
                        ref="iframe"
                        title={i18n.t("Dashboard")}
                        src={iFrameSrc}
                        style={styles.iframe}
                    />}
                </div>
            </React.Fragment>
        );
    }
}

const styles = {
    iframe: { width: "100%", height: 1000 },
};

export default withSnackbar(Dashboard);
