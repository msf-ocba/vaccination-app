import React from "react";
import PropTypes from "prop-types";
import GroupEditor from "@dhis2/d2-ui-group-editor/GroupEditor.component";
import GroupEditorWithOrdering from "@dhis2/d2-ui-group-editor/GroupEditorWithOrdering.component";
import { Store } from "@dhis2/d2-ui-core";
import { withStyles } from "@material-ui/core/styles";

const styles = theme => ({
    wrapper: {
        paddingBottom: 20,
    },
});

const optionsPropType = PropTypes.arrayOf(
    PropTypes.shape({
        value: PropTypes.string.isRequired,
        text: PropTypes.string.isRequired,
    })
);

class MultiSelector extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
        height: PropTypes.number,
        ordered: PropTypes.bool.isRequired,
        options: optionsPropType.isRequired,
        selected: PropTypes.arrayOf(PropTypes.string).isRequired,
    };

    static defaultProps = {
        height: 300,
    };

    // Required by <GroupEditor>
    static childContextTypes = {
        d2: PropTypes.object,
    };

    getChildContext() {
        return {
            d2: this.props.d2,
        };
    }

    assignItems = values => {
        const newValues = this.props.selected.concat(values);
        this.props.onChange(newValues);
        return Promise.resolve();
    };

    unassignItems = values => {
        const itemValuesToRemove = new Set(values);
        const newValues = this.props.selected.filter(value => !itemValuesToRemove.has(value));
        this.props.onChange(newValues);
        return Promise.resolve();
    };

    orderChanged = values => {
        this.props.onChange(values);
        return Promise.resolve();
    };

    render() {
        const { height, options, selected, classes, ordered } = this.props;

        const itemStore = Store.create();
        itemStore.setState(options);
        const assignedItemStore = Store.create();
        assignedItemStore.setState(selected);

        if (!itemStore.state) return null;

        const [GroupEditorComponent, extraProps] = ordered
            ? [GroupEditorWithOrdering, { onOrderChanged: this.orderChanged }]
            : [GroupEditor, {}];

        return (
            <div className={classes.wrapper} data-multi-selector={true}>
                <GroupEditorComponent
                    itemStore={itemStore}
                    assignedItemStore={assignedItemStore}
                    onAssignItems={this.assignItems}
                    onRemoveItems={this.unassignItems}
                    height={height}
                    {...extraProps}
                />
            </div>
        );
    }
}

export default withStyles(styles)(MultiSelector);
