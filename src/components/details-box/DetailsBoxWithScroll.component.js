import React, { Component } from "react";
import { debounce } from "throttle-debounce";
import DetailsBox from "./DetailsBox.component";
import Paper from "material-ui/Paper";

const styles = {
    paper: { maxWidth: 500, minWidth: 300 },
};

export default class DetailsBoxWithScroll extends Component {
    state = { scrollTop: 0 };

    constructor(props) {
        super(props);
        this.setScrollTopDebounced = debounce(200, this.setScrollTop.bind(this));
    }

    setScrollTop() {
        const scrollTop = document.documentElement.scrollTop;
        this.setState({ scrollTop });
    }

    componentDidMount() {
        global.addEventListener("scroll", this.setScrollTopDebounced);
    }

    componentWillUnmount() {
        global.removeEventListener("scroll", this.setScrollTopDebounced);
    }

    render() {
        const { scrollTop } = this.state;
        const paperStyle = { ...styles.paper, marginTop: Math.max(scrollTop - 60, 0) };

        return (
            <div style={this.props.style}>
                <Paper zDepth={1} rounded={false} style={paperStyle}>
                    <DetailsBox
                        source={this.props.detailsObject}
                        showDetailBox={!!this.props.detailsObject}
                        onClose={this.props.onClose}
                    />
                </Paper>
            </div>
        );
    }
}
