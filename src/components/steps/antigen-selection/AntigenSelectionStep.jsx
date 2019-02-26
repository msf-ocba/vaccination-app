import React from "react";
import PropTypes from "prop-types";
import _ from "lodash";
import { MultiSelector } from "d2-ui-components";

class AntigenSelectionStep extends React.Component {
    state = { categoryOptions: null };

    static propTypes = {
        d2: PropTypes.object.isRequired,
        campaign: PropTypes.object.isRequired,
        onChange: PropTypes.func.isRequired,
    };

    async componentDidMount() {
        const { campaign } = this.props;
        const categoryOptions = await campaign.getAvailableAntigens();
        this.setState({ categoryOptions });
    }

    onChange = selected => {
        const antigens = _(this.state.categoryOptions)
            .keyBy("id")
            .at(selected)
            .value();
        const newCampaign = this.props.campaign.setAntigens(antigens);
        this.props.onChange(newCampaign);
    };

    render() {
        const { d2, campaign } = this.props;
        const { categoryOptions } = this.state;

        if (!categoryOptions) return null;

        const options = categoryOptions.map(co => ({ value: co.id, text: co.displayName }));
        const selected = campaign.antigens.map(co => co.id);

        return (
            <div>
                <MultiSelector
                    d2={d2}
                    height={300}
                    onChange={this.onChange}
                    options={options}
                    selected={selected}
                    ordered={true}
                />
            </div>
        );
    }
}

export default AntigenSelectionStep;
