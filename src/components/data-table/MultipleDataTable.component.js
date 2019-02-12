import isIterable from "d2-utilizr/lib/isIterable";
import React from "react";
import update from "immutability-helper";
import MultipleDataTableRow from "./MultipleDataTableRow.component";
import DataTableHeader from "./DataTableHeader.component";
import MultipleDataTableContextMenu from "./MultipleDataTableContextMenu.component";
import PropTypes from "prop-types";
import _ from "utils/lodash";

class MultipleDataTable extends React.Component {
    static propTypes = {
        contextMenuActions: PropTypes.array,
        contextMenuIcons: PropTypes.object,
        primaryAction: PropTypes.func.isRequired,
        isContextActionAllowed: PropTypes.func,
        isMultipleSelectionAllowed: PropTypes.bool,
        columns: PropTypes.arrayOf(PropTypes.object).isRequired,
        sorting: PropTypes.array,
        hideRowsActionsIcon: PropTypes.bool,
        onColumnSort: PropTypes.func,
        styles: PropTypes.shape({
            table: PropTypes.object,
            header: PropTypes.object,
        }),
        activeRows: PropTypes.arrayOf(PropTypes.object),
        onActiveRowsChange: PropTypes.func,
    };

    static defaultProps = {
        styles: {},
        activeRows: [],
        onActiveRowsChange: () => {},
    };

    constructor(props) {
        super(props);
        this.state = this.getStateFromProps(props);
    }

    componentWillReceiveProps(newProps) {
        this.setState(this.getStateFromProps(newProps));
    }

    getStateFromProps(props) {
        let dataRows = [];

        if (isIterable(props.rows)) {
            dataRows = props.rows instanceof Map ? Array.from(props.rows.values()) : props.rows;
        }

        return {
            columns: props.columns,
            activeRows: props.activeRows,
            dataRows,
        };
    }

    renderContextMenu() {
        const { contextMenuActions, isContextActionAllowed } = this.props;
        const actionsToShow = contextMenuActions.filter(action =>
            isContextActionAllowed(this.state.activeRows, action.name)
        );

        return (
            <MultipleDataTableContextMenu
                target={this.state.contextMenuTarget}
                onRequestClose={this._hideContextMenu}
                actions={actionsToShow}
                activeItems={this.state.activeRows}
                showContextMenu={this.state.showContextMenu}
                icons={this.props.contextMenuIcons}
            />
        );
    }

    _onColumnSortingToggle(headerName) {
        const { sorting } = this.props;
        const newSortingDirection =
            sorting && sorting[0] === headerName ? (sorting[1] === "asc" ? "desc" : "asc") : "asc";
        const newSorting = [headerName, newSortingDirection];
        this.props.onColumnSort && this.props.onColumnSort(newSorting);
    }

    renderHeaders() {
        const [currentSortedColumn, currentSortedDirection] = this.props.sorting || [];

        return this.state.columns.map((column, index) => (
            <DataTableHeader
                key={column.name}
                style={column.style}
                isOdd={Boolean(index % 2)}
                name={column.name}
                contents={column.contents}
                text={column.text}
                sortable={!!column.sortable}
                sorting={currentSortedColumn === column.name ? currentSortedDirection : null}
                onSortingToggle={this._onColumnSortingToggle.bind(this, column.name)}
            />
        ));
    }

    renderRows() {
        return this.state.dataRows.map((dataRowsSource, dataRowsId) => {
            return (
                <MultipleDataTableRow
                    key={dataRowsId}
                    dataSource={dataRowsSource}
                    columns={this.state.columns.map(c => c.value || c.name)}
                    hideActionsIcon={this.props.hideRowsActionsIcon}
                    isActive={this.isRowActive(dataRowsSource)}
                    itemClicked={this.handleRowClick}
                    primaryClick={this.handlePrimaryClick}
                    style={dataRowsSource._style}
                />
            );
        });
    }

    render() {
        const defaultStyles = {
            table: {},
            header: {},
        };
        const styles = _.deepMerge(defaultStyles, this.props.styles);

        return (
            <div className="data-table" style={styles.table}>
                <div className="data-table__headers">
                    {this.renderHeaders()}
                    <DataTableHeader />
                </div>
                <div className="data-table__rows">{this.renderRows()}</div>
                {this.renderContextMenu()}
            </div>
        );
    }

    isRowActive(rowSource) {
        if (!this.state.activeRows) {
            return false;
        }
        return _.includes(this.state.activeRows, rowSource);
    }

    isEventCtrlClick(event) {
        return this.props.isMultipleSelectionAllowed && event && event.ctrlKey;
    }

    notifyActiveRows = () => {
        this.props.onActiveRowsChange(this.state.activeRows);
    };

    handleRowClick = (event, rowSource) => {
        //Update activeRows according to click|ctlr+click
        var newActiveRows;
        if (event.isIconMenuClick) {
            newActiveRows = [rowSource];
        } else if (this.isEventCtrlClick(event) || this.isRowActive(rowSource)) {
            //Remain selection + rowSource if not already selected
            newActiveRows = this.updateContextSelection(rowSource);
        } else {
            //Context click just selects current row
            newActiveRows = [rowSource];
        }

        //Update state
        this.setState(
            {
                contextMenuTarget: event.currentTarget,
                showContextMenu: true,
                activeRows: newActiveRows,
            },
            this.notifyActiveRows
        );
    };

    handlePrimaryClick = (event, rowSource) => {
        //Click -> Clears selection, Invoke external action (passing event)
        if (!this.isEventCtrlClick(event)) {
            this.setState(
                {
                    activeRows: [],
                },
                this.notifyActiveRows
            );
            this.props.primaryAction(rowSource);
            return;
        }

        //Ctrl + Click -> Update selection
        const newActiveRows = this.updatePrimarySelection(rowSource);
        this.setState(
            {
                activeRows: newActiveRows,
                showContextMenu: false,
            },
            this.notifyActiveRows
        );
    };

    _hideContextMenu = () => {
        this.setState(
            {
                activeRows: [],
                showContextMenu: false,
            },
            this.notifyActiveRows
        );
    };

    updateContextSelection(rowSource) {
        return this.updateSelection(rowSource, true);
    }

    updatePrimarySelection(rowSource) {
        return this.updateSelection(rowSource, false);
    }

    updateSelection(rowSource, isContextClick) {
        const alreadySelected = this.isRowActive(rowSource);

        //ctx click + Already selected -> Same selection
        if (isContextClick && alreadySelected) {
            return this.state.activeRows;
        }

        //click + Already selected -> Remove from selection
        if (alreadySelected) {
            return this.state.activeRows.filter(nRow => nRow !== rowSource);
        }

        //!already selected -> Add to selection
        return update(this.state.activeRows ? this.state.activeRows : [], { $push: [rowSource] });
    }
}

export default MultipleDataTable;
