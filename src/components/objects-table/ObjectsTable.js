import React from "react";
import PropTypes from "prop-types";
import fp from "lodash/fp";
import _ from "lodash";
import i18n from "@dhis2/d2-i18n";
import Checkbox from "material-ui/Checkbox/Checkbox";
import CircularProgress from "@material-ui/core/CircularProgress";
import { withRouter } from "react-router-dom";

import SearchBox from "components/search-box/SearchBox.component";
import Pagination from "components/data-table/Pagination.component";
import MultipleDataTable from "components/data-table/MultipleDataTable.component";
import DetailsBoxWithScroll from "components/details-box/DetailsBoxWithScroll.component";
import "components/data-table/Pagination.scss";
import "components/data-table/DataTable.scss";
import * as actions from "./actions";
import * as DataSets from "models/DataSets";
import SimpleCheckBox from "../forms/SimpleCheckBox";
import { formatDateLong } from "utils/date.js";
import { canCreate } from "../../utils/auth";
import ListActionBar from "./ListActionBar.component";

class ObjectsTable extends React.Component {
    pageSize = 20;

    static propTypes = {
        d2: PropTypes.object.isRequired,
        name: PropTypes.string,
    };

    constructor(props) {
        super(props);
        this.state = this._getInitialState();
        this.actions = actions.get(this._onContextAction);
    }

    _setState(newState) {
        return () => {
            this.setState(newState);
        };
    }

    _onContextAction = (key, objects) => {
        switch (key) {
            case "details":
                this.setState({ detailsObject: objects });
                break;
            default:
                console.log("TODO", key, objects);
        }
    };

    newDataset = () => {
        this.props.history.push("/campaign-configurator/new");
    };

    _getInitialState() {
        return {
            isLoading: true,
            page: 1,
            pager: { total: 0 },
            dataRows: [],
            sorting: ["displayName", "asc"],
            searchValue: null,
            showOnlyUserCampaigns: true,
            detailsObject: null,
        };
    }

    componentDidMount() {
        this.getDataSets({});
    }

    getDataSetsOnCurrentPage() {
        this.getDataSets({ clearPage: false });
    }

    async getDataSets({ clearPage = true } = {}) {
        const { d2 } = this.props;
        const { page, sorting, searchValue, showOnlyUserCampaigns } = this.state;
        const newPage = clearPage ? 1 : page;
        const filters = { searchValue, showOnlyUserCampaigns };
        const pagination = { page: newPage, pageSize: this.pageSize, sorting };
        const dataSetsCollection = await DataSets.get(d2, filters, pagination);
        const dataRows = dataSetsCollection
            .toArray()
            .map(dr =>
                _.merge(dr, { selected: false, lastUpdatedHuman: formatDateLong(dr.lastUpdated) })
            );

        this.setState({
            isLoading: false,
            pager: dataSetsCollection.pager,
            dataRows: dataRows,
            page: newPage,
        });
    }

    onSearchChange = value => {
        this.setState(
            {
                isLoading: true,
                searchValue: value,
            },
            this.getDataSets
        );
    };

    onSelectToggle(ev, dataset) {
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({
            dataRows: this.state.dataRows.map(
                dr => (dr.id === dataset.id ? _.merge(dr, { selected: !dr.selected }) : dr)
            ),
        });
    }

    onSelectAllToggle = value => {
        this.setState({
            dataRows: this.state.dataRows.map(dr => _.merge(dr, { selected: !value })),
        });
    };

    onActiveRowsChange = datasets => {
        const selectedIds = new Set(datasets.map(ds => ds.id));

        this.setState({
            dataRows: this.state.dataRows.map(dr =>
                _.merge(dr, { selected: selectedIds.has(dr.id) })
            ),
        });
    };

    _onColumnSort = sorting => {
        this.setState({ sorting, isLoading: true }, this.getDataSets);
    };

    _toggleShowOnlyUserCampaigns = ev => {
        this.setState(
            { showOnlyUserCampaigns: ev.target.checked, isLoading: true },
            this.getDataSets
        );
    };

    _getPaginationProps() {
        const currentlyShown = calculatePageValue(this.state.pager, this.pageSize);
        const { pager } = this.state;

        return {
            hasNextPage: () => Boolean(pager.hasNextPage) && pager.hasNextPage(),
            hasPreviousPage: () => Boolean(pager.hasPreviousPage) && pager.hasPreviousPage(),
            onNextPageClick: () => {
                this.setState(
                    {
                        isLoading: true,
                        page: pager.page + 1,
                    },
                    this.getDataSetsOnCurrentPage
                );
            },
            onPreviousPageClick: () => {
                this.setState(
                    {
                        isLoading: true,
                        page: pager.page - 1,
                    },
                    this.getDataSetsOnCurrentPage
                );
            },
            total: pager.total,
            currentlyShown,
        };
    }

    isContextActionAllowed = (...args) => {
        return this.actions.isContextActionAllowed(this.props.d2, ...args);
    };

    render() {
        const { d2 } = this.props;
        const { dataRows, showOnlyUserCampaigns, sorting } = this.state;
        const paginationProps = this._getPaginationProps();
        const rows = dataRows.map(dr =>
            fp.merge(dr, {
                selected: (
                    <SimpleCheckBox
                        onClick={ev => this.onSelectToggle(ev, dr)}
                        checked={dr.selected}
                    />
                ),
            })
        );
        const selectedHeaderChecked = !_.isEmpty(dataRows) && dataRows.every(row => row.selected);

        const selectedColumnContents = (
            <Checkbox
                checked={selectedHeaderChecked}
                onCheck={() => this.onSelectAllToggle(selectedHeaderChecked)}
                iconStyle={{ width: "auto" }}
            />
        );

        const columns = [
            {
                name: "selected",
                style: { width: 20 },
                text: "",
                sortable: false,
                contents: selectedColumnContents,
            },
            { name: "displayName", text: i18n.t("Name"), sortable: true },
            { name: "publicAccess", text: i18n.t("Public access"), sortable: true },
            {
                name: "lastUpdated",
                text: i18n.t("Last updated"),
                sortable: true,
                value: "lastUpdatedHuman",
            },
        ];

        const activeRows = _(rows)
            .keyBy("id")
            .at(dataRows.filter(dr => dr.selected).map(dr => dr.id))
            .value();

        return (
            <div>
                <div>
                    <div style={{ float: "left", width: "33%" }}>
                        <SearchBox onChange={this.onSearchChange} />
                    </div>

                    <Checkbox
                        style={{ float: "left", width: "25%", paddingTop: 18, marginLeft: 30 }}
                        checked={showOnlyUserCampaigns}
                        data-test="only-my-campaigns"
                        label={i18n.t("Only my campaigns")}
                        onCheck={this._toggleShowOnlyUserCampaigns}
                        iconStyle={{ marginRight: 8 }}
                    />

                    <div style={{ float: "right" }}>
                        <Pagination {...paginationProps} />
                    </div>

                    <div style={{ float: "right" }}>
                        {this.state.isLoading && <CircularProgress size={30} />}
                    </div>
                    <div style={{ clear: "both" }} />
                </div>

                <div style={styles.listDetailsWrap}>
                    <div style={styles.dataTableWrap}>
                        <MultipleDataTable
                            rows={rows}
                            columns={columns}
                            sorting={sorting}
                            onColumnSort={this._onColumnSort}
                            contextMenuActions={this.actions.contextActions}
                            contextMenuIcons={this.actions.contextMenuIcons}
                            primaryAction={this.actions.contextActions[0].fn}
                            isContextActionAllowed={this.isContextActionAllowed}
                            activeRows={activeRows}
                            onActiveRowsChange={this.onActiveRowsChange}
                            isMultipleSelectionAllowed={true}
                        />
                        {dataRows.length > 0 || this.state.isLoading ? null : (
                            <div>No results found</div>
                        )}
                    </div>
                    {this.state.detailsObject ? (
                        <DetailsBoxWithScroll
                            style={styles.detailsBoxWrap}
                            detailsObject={this.state.detailsObject}
                            onClose={this._setState({ detailsObject: null })}
                        />
                    ) : null}
                </div>

                {canCreate(d2) && <ListActionBar onClick={this.newDataset} />}
            </div>
        );
    }
}

function calculatePageValue(pager, defaultPerPage) {
    const { total, pageCount, page, query } = pager;
    const pageSize = query ? query.pageSize : defaultPerPage;
    const pageCalculationValue = total - (total - (pageCount - (pageCount - page)) * pageSize);
    const startItem = 1 + pageCalculationValue - pageSize;
    const endItem = pageCalculationValue;

    return `${startItem} - ${endItem > total ? total : endItem}`;
}

const styles = {
    dataTableWrap: {
        display: "flex",
        flexDirection: "column",
        flex: 2,
    },

    detailsBoxWrap: {
        flex: 1,
        marginLeft: "1rem",
        marginRight: "1rem",
        opacity: 1,
        flexGrow: 0,
    },

    listDetailsWrap: {
        flex: 1,
        display: "flex",
        flexOrientation: "row",
    },
};

export default withRouter(ObjectsTable);
