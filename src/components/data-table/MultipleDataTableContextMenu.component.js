import React from "react";
import Menu from "material-ui/Menu";
import MenuItem from "material-ui/MenuItem";
import FontIcon from "material-ui/FontIcon";
import Popover from "./PopoverNoFlicker";
import Paper from "material-ui/Paper";
import PropTypes from "prop-types";
import _ from "lodash";

class MultipleDataTableContextMenu extends React.Component {
    static propTypes = {
        actions: PropTypes.arrayOf(
            PropTypes.shape({
                name: PropTypes.string.isRequired,
                text: PropTypes.string.isRequired,
                fn: PropTypes.func.isRequired,
            })
        ),
        showContextMenu: PropTypes.bool,
        activeItems: PropTypes.array,
        icons: PropTypes.object,
        target: PropTypes.object,
    };

    static defaultProps = {
        icons: {},
        actions: [],
    };

    render() {
        const cmStyle = {
            position: "fixed",
        };
        const {
            actions,
            target,
            activeItems,
            icons,
            showContextMenu,
            ...popoverProps
        } = this.props;

        return (
            <Popover
                {...popoverProps}
                open={showContextMenu}
                anchorEl={target}
                anchorOrigin={{ horizontal: "middle", vertical: "center" }}
                animated={false}
                style={cmStyle}
                animation={Paper}
            >
                <Menu className="data-table__context-menu" desktop>
                    {actions.map(action => {
                        const iconName = icons[action.name] ? icons[action.name] : action.name;

                        return (
                            <MenuItem
                                key={action.name}
                                data-object-id={activeItems}
                                className={"data-table__context-menu__item"}
                                onClick={this.handleClick.bind(this, action.name)}
                                primaryText={action.text}
                                leftIcon={
                                    <FontIcon className="material-icons">{iconName}</FontIcon>
                                }
                            />
                        );
                    })}
                </Menu>
            </Popover>
        );
    }

    handleClick(action) {
        const fn = _(this.props.actions)
            .keyBy("name")
            .get([action, "fn"]);
        fn.apply(this.props.actions, this.props.activeItems);
        this.props.onRequestClose && this.props.onRequestClose();
    }
}

export default MultipleDataTableContextMenu;
