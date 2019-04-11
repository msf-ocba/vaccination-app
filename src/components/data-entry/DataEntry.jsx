import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";
import { withSnackbar } from "d2-ui-components";
import ReactDOM from "react-dom";

import PageHeader from "../shared/PageHeader";
// import { canManage, canDelete, canUpdate, canCreate } from "d2-ui-components/auth";
// import { list, getDashboardId } from "../../models/datasets";
// import { goToDhis2Url } from "../../utils/routes";

class DataEntry extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
        config: PropTypes.object.isRequired,
    };

    // canCreateDataSets = canCreate(this.props.d2, this.props.d2.models.dataSet, "public");

    componentDidMount() {
        let iframe = ReactDOM.findDOMNode(this.refs.iframe);
        console.log(process.env.REACT_APP_DHIS2_BASE_URL);
        iframe.addEventListener("load", this.setDatasetParameters.bind(this));
    }

    async setDatasetParameters() {
        const {
            d2,
            match: { params },
        } = this.props;

        const fields = ["id,organisationUnits[id,name]"].join(",");
        const dataSet = await d2.models.dataSets.get(params.id, { fields });
        const organisationUnitId = dataSet.organisationUnits.toArray()[0].id;
        let iframe = ReactDOM.findDOMNode(this.refs.iframe);
        iframe.contentWindow.selection.select(organisationUnitId);
        setTimeout(function() {
            // selection.getSelected()
            // selection.isBusy()
            iframe.contentWindow.document.querySelector(
                `#selectedDataSetId [value="${params.id}"]`
            ).selected = true;
            iframe.contentWindow.dataSetSelected();
        }, 10000);
    }

    onCreate = () => {
        this.props.history.push("/campaign-configuration/new");
    };

    backHome = () => {
        this.props.history.push("/");
    };

    render() {
        // const { d2 } = this.props;
        return (
            <React.Fragment>
                <PageHeader title={i18n.t("Data Entry")} onBackClick={this.backHome} />
                <div>
                    <iframe
                        ref="iframe"
                        title={i18n.t("Data Entry")}
                        src="http://localhost:8080/dhis-web-dataentry/index.action"
                        style={styles.iframe}
                    />
                </div>
            </React.Fragment>
        );
    }
}

const styles = {
    iframe: { width: "100%", height: 1000 },
};

export default withSnackbar(DataEntry);
