import React from "react";
import PropTypes from "prop-types";
import ObjectsTable from "../objects-table/ObjectsTable";

class CampaignConfigurator extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
    };

    render() {
        return (
            <div>
                <ObjectsTable d2={this.props.d2} />
            </div>
        );
    }
}

export default CampaignConfigurator;
