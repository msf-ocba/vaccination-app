import React from "react";
import { debounce } from "throttle-debounce";
import PropTypes from "prop-types";
import TextField from "material-ui/TextField";
import i18n from "@dhis2/d2-i18n";

class SearchBox extends React.Component {
    static propTypes = {
        onChange: PropTypes.func.isRequired,
        debounce: PropTypes.number,
    };

    static defaultProps = {
        debounce: 400,
    };

    constructor(props) {
        super(props);
        this.state = { value: "" };
        this.onChangeDebounced = debounce(props.debounce, props.onChange);
    }

    render() {
        return (
            <TextField
                value={this.state.value}
                fullWidth
                type="search"
                onChange={this.onKeyUp}
                hintText={`${i18n.t("Search by name")}`}
                data-test="search"
            />
        );
    }

    onKeyUp = event => {
        const { value } = event.target;
        this.onChangeDebounced(value.trim());
        this.setState({ value });
    };
}

export default SearchBox;
