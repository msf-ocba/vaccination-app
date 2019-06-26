import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";
import { withSnackbar } from "d2-ui-components";
import ReactDOM from "react-dom";
import moment from "moment";

import PageHeader from "../shared/PageHeader";
import { getOrganisationUnitsById, getDataInputPeriodsById } from "../../models/datasets";
import { getDhis2Url } from "../../utils/routes";
import { LinearProgress } from "@material-ui/core";

class DataEntry extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
        config: PropTypes.object.isRequired,
    };

    state = {
        isDataEntryIdValid: false,
    };

    async componentDidMount() {
        const {
            d2,
            match: { params },
        } = this.props;
        const dataSetId = params.id;
        const organisationUnits = dataSetId ? await getOrganisationUnitsById(dataSetId, d2) : null;

        if (!dataSetId || (dataSetId && organisationUnits)) {
            this.setState({ isDataEntryIdValid: true }, () => {
                const iframe = ReactDOM.findDOMNode(this.refs.iframe);
                iframe.addEventListener(
                    "load",
                    this.setDatasetParameters.bind(this, iframe, dataSetId, organisationUnits, d2)
                );
            });
        } else {
            this.props.snackbar.error(i18n.t("Cannot find dataset associated with the campaign"));
        }
    }

    waitforOUSelection(element) {
        return new Promise(resolve => {
            const check = () => {
                if (element.childNodes.length > 0) {
                    resolve();
                } else {
                    setTimeout(check, 500);
                }
            };

            check();
        });
    }

    styleFrame(iframeDocument) {
        iframeDocument.querySelector("#header").remove();
        iframeDocument.querySelector("#leftBar").style.top = "-10px";
        iframeDocument.querySelector("body").style.marginTop = "-55px";
        iframeDocument.querySelector("#moduleHeader").remove();

        on(iframeDocument, "#currentSelection", el => el.remove());
        on(iframeDocument, "#validationButton", el => el.remove());
        on(iframeDocument, "#completenessDiv #validateButton", el => el.remove());
        on(iframeDocument, "#completenessDiv .separator", el => el.remove());

        on(iframeDocument, "#completenessDiv", div => {
            div.style.display = "inline-block";
            div.style.paddingRight = "20px";
            div.style.width = "auto";
        });
    }

    async setDatasetParameters(iframe, dataSetId, organisationUnits, d2) {
        const iframeDocument = iframe.contentWindow.document;
        this.styleFrame(iframeDocument);

        if (organisationUnits) {
            // Select OU in the tree
            const iframeSelection = iframe.contentWindow.selection;
            iframeSelection.select(organisationUnits);

            // Wait for OU to be selected and select the dataset
            await this.waitforOUSelection(iframeDocument.querySelector("#selectedDataSetId"));
            iframeDocument.querySelector(
                `#selectedDataSetId [value="${dataSetId}"]`
            ).selected = true;
            iframe.contentWindow.dataSetSelected();

            // Remove non-valid periods
            const dataInputPeriods = await getDataInputPeriodsById(dataSetId, d2);
            const removeNonValidPeriods = () => {
                const selectedDataSetId = iframeDocument.querySelector("#selectedDataSetId")
                    .selectedOptions[0].value;
                if (selectedDataSetId === dataSetId) {
                    const selectPeriod = iframeDocument.querySelector("#selectedPeriodId");
                    const optionPeriods = Array.from(selectPeriod.childNodes);
                    optionPeriods.forEach(option => {
                        const optionFormat = moment(option.value);
                        if (
                            optionFormat.isValid() &&
                            !optionFormat.isBetween(
                                dataInputPeriods.openingDate,
                                dataInputPeriods.closingDate,
                                null,
                                "[]"
                            )
                        ) {
                            selectPeriod.removeChild(option);
                        }
                    });
                }
            };
            removeNonValidPeriods();
            iframeDocument
                .querySelectorAll("#selectedDataSetId, #prevButton, #nextButton")
                .forEach(element => {
                    element.addEventListener("click", () => {
                        removeNonValidPeriods();
                    });
                });
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

    render() {
        const { isDataEntryIdValid } = this.state;
        const dataEntryUrl = getDhis2Url(this.props.d2, "/dhis-web-dataentry/index.action");

        return (
            <React.Fragment>
                <PageHeader
                    title={i18n.t("Data Entry")}
                    onBackClick={this.backCampaignConfiguration}
                />
                <div>
                    {isDataEntryIdValid ? (
                        <iframe
                            ref="iframe"
                            title={i18n.t("Data Entry")}
                            src={dataEntryUrl}
                            style={styles.iframe}
                        />
                    ) : (
                        <LinearProgress />
                    )}
                </div>
            </React.Fragment>
        );
    }
}

const styles = {
    iframe: { width: "100%", height: 1000 },
};

function on(document, selector, cb) {
    document.querySelectorAll(selector).forEach(cb);
}

export default withSnackbar(DataEntry);
