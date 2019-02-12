import React from "react";
import classes from "classnames";
import ArrowUp from "material-ui/svg-icons/hardware/keyboard-arrow-up.js";
import ArrowDown from "material-ui/svg-icons/hardware/keyboard-arrow-down.js";
import PropTypes from "prop-types";

class DataTableHeader extends React.Component {
    static propTypes = {
        isOdd: PropTypes.bool,
        name: PropTypes.string,
        text: PropTypes.string,
        contents: PropTypes.element,
        sortable: PropTypes.bool,
        sorting: PropTypes.oneOf(["asc", "desc"]),
        onSortingToggle: PropTypes.func,
        style: PropTypes.object,
    };

    static defaultProps = {
        isOdd: false,
        name: null,
        text: null,
        contents: null,
        sortable: false,
        sorting: null,
        style: {},
    };

    _renderSorting() {
        const style = { width: 16, height: 16 };

        switch (this.props.sorting) {
            case "desc":
                return <ArrowDown style={style} />;
            case "asc":
                return <ArrowUp style={style} />;
            default:
                // When not visible, render the component anyway to reserve space
                return <ArrowUp style={Object.assign({}, style, { visibility: "hidden" })} />;
        }
    }

    render() {
        const { isOdd, sortable, text, contents, style } = this.props;
        const styleWithSorting = sortable ? { cursor: "pointer", ...style } : style;
        const classList = classes("data-table__headers__header", {
            "data-table__headers__header--even": !isOdd,
            "data-table__headers__header--odd": isOdd,
        });

        return (
            <div
                className={classList}
                style={styleWithSorting}
                {...(sortable ? { onClick: this.props.onSortingToggle } : {})}
            >
                {contents}
                {text}
                {sortable ? this._renderSorting() : null}
            </div>
        );
    }
}

export default DataTableHeader;
