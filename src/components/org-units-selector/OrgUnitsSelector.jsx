import React from "react";
import PropTypes from "prop-types";

import Card from "material-ui/Card/Card";
import CardText from "material-ui/Card/CardText";

import i18n from "@dhis2/d2-i18n";
import { OrgUnitTree } from "@dhis2/d2-ui-org-unit-tree";
import { OrgUnitSelectByLevel } from "@dhis2/d2-ui-org-unit-select";
import { OrgUnitSelectByGroup } from "@dhis2/d2-ui-org-unit-select";
import { OrgUnitSelectAll } from "@dhis2/d2-ui-org-unit-select";

import {
    mergeChildren,
    incrementMemberCount,
    decrementMemberCount,
} from "@dhis2/d2-ui-org-unit-tree";

// Base code from d2-ui/examples/create-react-app/src/components/org-unit-selector.js

const styles = {
    card: {
        display: "inline-block",
        margin: 16,
        width: 610,
        transition: "all 175ms ease-out",
    },
    cardText: {
        paddingTop: 10,
        height: 420,
        position: "relative",
    },
    cardHeader: {
        padding: "16px",
        margin: "16px -16px",
        borderBottom: "1px solid #eeeeee",
    },
    left: {
        display: "inline-block",
        position: "absolute",
        height: 350,
        width: 500,
        overflowY: "scroll",
        marginBottom: 16,
    },
    right: {
        display: "inline-block",
        position: "absolute",
        width: 500,
        right: 16,
    },
    ouLabel: {
        background: "rgba(0,0,0,0.05)",
        borderRadius: 5,
        border: "1px solid rgba(0,0,0,0.1)",
        padding: "1px 6px 1px 3px",
        fontStyle: "italic",
    },
    selectByLevel: {
        marginBottom: -24,
        marginTop: -16,
    },
    selectAll: {
        float: "right",
    }
};
styles.cardWide = Object.assign({}, styles.card, {
    width: 1052,
});

export default class OrgUnitsSelector extends React.Component {
    static propTypes = {
        d2: PropTypes.object.isRequired,
        onChange: PropTypes.func.isRequired,
        selected: PropTypes.arrayOf(PropTypes.string).isRequired,
    };

    static childContextTypes = {
        d2: PropTypes.object.isRequired,
    };

    constructor(props) {
        super(props);

        this.state = {
            d2: props.d2,
        };

        Promise.all([
            props.d2.models.organisationUnitLevels.list({
                paging: false,
                fields: "id,level,displayName",
                order: "level:asc",
            }),
            props.d2.models.organisationUnitGroups.list({
                paging: false,
                fields: "id,displayName",
            }),
            props.d2.models.organisationUnits.list({
                paging: false,
                level: 1,
                fields: "id,displayName,path,children::isNotEmpty",
            }),
        ]).then(([levels, groups, roots]) => {
            this.setState({
                levels,
                rootWithMembers: roots.toArray()[0],
                groups,
            });
        });
    }

    getChildContext() {
        return {
            d2: this.props.d2,
        };
    }

    handleSelectionUpdate = newSelection => {
        this.props.onChange(newSelection);
    };

    handleOrgUnitClick = (event, orgUnit) => {
        if (this.props.selected.includes(orgUnit.path)) {
            const newSelected = [...this.props.selected];
            newSelected.splice(this.props.selected.indexOf(orgUnit.path), 1);
            decrementMemberCount(this.state.rootWithMembers, orgUnit);
            this.props.onChange(newSelected);
        } else {
            incrementMemberCount(this.state.rootWithMembers, orgUnit);
            const newSelected = this.props.selected.concat(orgUnit.path);
            this.props.onChange(newSelected);
        }
    };

    handleChildrenLoaded = children => {
        this.setState(state => ({
            rootWithMembers: mergeChildren(state.rootWithMembers, children),
        }));
    };

    renderOrgUnitSelectTitle = () => {
        const { currentRoot } = this.state;

        return currentRoot ? (
            <div>
                {i18n.t("For organisation units within")}
                <span style={styles.ouLabel}>{currentRoot.displayName}</span>:{" "}
            </div>
        ) : (
            <div>{i18n.t("For all organisation units")}:</div>
        );
    };

    changeRoot = currentRoot => {
        this.setState({ currentRoot });
    };

    render() {
        const { levels, currentRoot, rootWithMembers, groups } = this.state;
        const { selected } = this.props;
        const { renderOrgUnitSelectTitle: OrgUnitSelectTitle } = this;

        if (!levels) return null;

        return (
            <div>
                <Card style={styles.cardWide}>
                    <CardText style={styles.cardText}>
                        <div style={styles.left}>
                            <OrgUnitTree
                                root={rootWithMembers}
                                selected={selected}
                                currentRoot={currentRoot}
                                initiallyExpanded={[`/${rootWithMembers.id}`]}
                                onSelectClick={this.handleOrgUnitClick}
                                onChangeCurrentRoot={this.changeRoot}
                                onChildrenLoaded={this.handleChildrenLoaded}
                            />
                        </div>

                        <div style={styles.right}>
                            <div>
                                <OrgUnitSelectTitle />

                                <div style={styles.selectByLevel}>
                                    <OrgUnitSelectByLevel
                                        levels={levels}
                                        selected={selected}
                                        currentRoot={currentRoot}
                                        onUpdateSelection={this.handleSelectionUpdate}
                                    />
                                </div>

                                <div>
                                    <OrgUnitSelectByGroup
                                        groups={groups}
                                        selected={selected}
                                        currentRoot={currentRoot}
                                        onUpdateSelection={this.handleSelectionUpdate}
                                    />
                                </div>

                                <div style={styles.selectAll}>
                                    <OrgUnitSelectAll
                                        selected={selected}
                                        currentRoot={currentRoot}
                                        onUpdateSelection={this.handleSelectionUpdate}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardText>
                </Card>
            </div>
        );
    }
}
