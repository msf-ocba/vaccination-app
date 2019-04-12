import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";
import { withSnackbar } from "d2-ui-components";
import ReactDOM from "react-dom";

import PageHeader from "../shared/PageHeader";
import { getOrganisationUnitsById } from "../../models/datasets";

class DataEntry extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
        config: PropTypes.object.isRequired,
    };

    state = {
        isDataEntryIdValid: true,
    };

    async componentDidMount() {
        const {
            d2,
            match: { params },
        } = this.props;
        const dataSetId = params.id;
        const organisationUnits = await getOrganisationUnitsById(dataSetId, d2);

        if (organisationUnits) {
            let iframe = ReactDOM.findDOMNode(this.refs.iframe);
            iframe.addEventListener(
                "load",
                this.setDatasetParameters.bind(this, iframe, dataSetId, organisationUnits)
            );
        } else {
            this.props.snackbar.error(i18n.t("Cannot find dataset associated to the campaign"));
            this.setState({ isDataEntryIdValid: false });
        }
    }

    waitforOUSelection(element) {
        return new Promise(resolve => {
            var check = () => {
                if (element.value === "-1") {
                    resolve();
                } else {
                    setTimeout(check, 1000);
                }
            };

            check();
        });
    }

    styleFrame(iframeDocument) {
        iframeDocument.querySelector(`#header`).remove();
        iframeDocument.querySelector(`#leftBar`).style.top = "-10px";
        iframeDocument.querySelector(`body`).style.marginTop = "-55px";
        iframeDocument.querySelector(`#moduleHeader`).remove();
    }

    async setDatasetParameters(iframe, dataSetId, organisationUnits) {
        const iframeDocument = iframe.contentWindow.document;
        this.styleFrame(iframeDocument);

        // Select OU in the tree
        const iframeSelection = iframe.contentWindow.selection;
        iframeSelection.select(organisationUnits);

        // Wait for OU to be selected and select the dataset
        await this.waitforOUSelection(iframeDocument.querySelector(`#selectedDataSetId`));
        iframeDocument.querySelector(`#selectedDataSetId [value="${dataSetId}"]`).selected = true;
        iframe.contentWindow.dataSetSelected();
    }

    backCampaignConfigurator = () => {
        this.props.history.push("/campaign-configuration");
    };

    render() {
        const { isDataEntryIdValid } = this.state;
        return (
            <React.Fragment>
                <PageHeader
                    title={i18n.t("Data Entry")}
                    onBackClick={this.backCampaignConfigurator}
                />
                <div>
                    {isDataEntryIdValid && (
                        <iframe
                            ref="iframe"
                            title={i18n.t("Data Entry")}
                            src={"/dhis-web-dataentry/index.action"}
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

export default withSnackbar(DataEntry);
