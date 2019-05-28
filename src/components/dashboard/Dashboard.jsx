import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";
import { withSnackbar } from "d2-ui-components";
import ReactDOM from "react-dom";

import PageHeader from "../shared/PageHeader";
import { getDatasetById, getDashboardId } from "../../models/datasets";
import { getDhis2Url } from "../../utils/routes";

class Dashboard extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
        config: PropTypes.object.isRequired,
    };

    state = {
        iFrameSrc: "",
    };

    async componentDidMount() {
        const {
            d2,
            match: { params },
            config,
        } = this.props;
        const dataSetId = params.id;
        const dashboardURL = await this.getDashboardURL(dataSetId, config, d2);

        this.setState({ iFrameSrc: dashboardURL }, () => {
            const { iFrameSrc } = this.state;
            if (iFrameSrc) {
                const iframe = ReactDOM.findDOMNode(this.refs.iframe);
                iframe.addEventListener(
                    "load",
                    this.setDashboardStyling.bind(this, iframe, dataSetId)
                );
            }
        });
    }

    waitforElementToLoad(iframeDocument, selector) {
        return new Promise(resolve => {
            const check = () => {
                if (iframeDocument.querySelector(selector)) {
                    resolve();
                } else {
                    setTimeout(check, 1000);
                }
            };

            check();
        });
    }

    async setDashboardStyling(iframe, dataSetId) {
        const iframeDocument = iframe.contentWindow.document;

        await this.waitforElementToLoad(iframeDocument, ".app-wrapper");
        const iFrameRoot = iframeDocument.querySelector("#root");
        const iFrameWrapper = iframeDocument.querySelector(".app-wrapper");
        const pageContainer = iframeDocument.querySelector(".page-container-top-margin");
        const controlBar = iframeDocument.querySelector(".d2-ui-control-bar");

        iFrameWrapper.removeChild(iFrameWrapper.firstChild).remove();
        pageContainer.style.marginTop = "0px";
        iFrameRoot.style.marginTop = "0px";
        controlBar.style.top = 0;
        
        if (dataSetId) {
            iFrameWrapper.removeChild(iFrameWrapper.firstChild).remove();
            
            await this.waitforElementToLoad(iframeDocument, ".titlebar-wrapper");
            const editButton = iframeDocument.querySelector(".titlebar-wrapper a[href*='edit']");
            if (editButton) editButton.remove();
        }
    }

    backCampaignConfiguration = () => {
        const {
            match: { params },
        } = this.props;
        if (params.id) {
            this.props.history.push("/campaign-configuration");
        } else {
            this.props.history.push("/");
        }
    };

    async getDashboardURL(dataSetId, config, d2) {
        const dataSet = dataSetId ? await getDatasetById(dataSetId, d2) : null;
        if (!dataSetId) {
            return getDhis2Url(d2, `/dhis-web-dashboard/#/`);
        } else if (dataSet) {
            const dashboardId = getDashboardId(dataSet, config);
            return getDhis2Url(d2, `/dhis-web-dashboard/#/${dashboardId}`);
        } else {
            this.props.snackbar.error(i18n.t("Cannot find dashboard associated with the campaign"));
        }
    }

    render() {
        const { iFrameSrc } = this.state;
        return (
            <React.Fragment>
                <PageHeader
                    title={i18n.t("Dashboard")}
                    onBackClick={this.backCampaignConfiguration}
                />
                <div>
                    {iFrameSrc && (
                        <iframe
                            ref="iframe"
                            title={i18n.t("Dashboard")}
                            src={iFrameSrc}
                            style={styles.iframe}
                        />
                    )}
                </div>
            </React.Fragment>
        );
    }
}

const styles = {
    iframe: { width: "100%", height: 1000 },
};

export default withSnackbar(Dashboard);
