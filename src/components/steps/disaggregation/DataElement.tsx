import React, { SFC } from "react";
import _ from "lodash";

import { withStyles } from "@material-ui/core/styles";
import { createStyles, WithStyles, Theme } from "@material-ui/core";
import { MuiThemeProvider, IconButton, Icon } from "@material-ui/core";

import i18n from "../../../locales";
import { AntigenDisaggregationCategoriesData } from "../../../models/AntigensDisaggregation";
import SimpleCheckbox from "../../forms/SimpleCheckBox";
import OptionGroup from "./OptionGroup";

type Path = (number | string)[];

interface DataElementProps extends WithStyles<typeof styles> {
    antigenCode: string;
    dataElementIdx: number;
    categories: AntigenDisaggregationCategoriesData;
    basePath: Path;
    update: (path: Path) => (value: any) => void;
    isEditing: (path: Path) => boolean;
    toggleEdit: (path: Path) => () => void;
}

const DataElement: SFC<DataElementProps> = props => {
    const {
        antigenCode,
        dataElementIdx,
        categories,
        classes,
        update,
        isEditing,
        toggleEdit,
    } = props;

    const isEditingCategory = (categoryIdx: number) =>
        isEditing([antigenCode, dataElementIdx, categoryIdx]);
    const basePath = [antigenCode, "dataElements", dataElementIdx, "categories"];

    return (
        <div className={classes.categories}>
            <div className={classes.categoriesWrapper}>{i18n.t("Disaggregation")}</div>
            {categories.map((category, categoryIdx) => (
                <div key={category.code} className={classes.categoriesWrapper}>
                    <SimpleCheckbox
                        key={category.code}
                        checked={category.selected}
                        disabled={!category.optional}
                        label={category.name}
                        onChange={update([...basePath, categoryIdx, "selected"])}
                    />

                    {category.selected && (
                        <div className={classes.categoryWrapper}>
                            {category.options.map((optionGroup, groupIndex) => (
                                <div
                                    key={groupIndex}
                                    className={_([
                                        classes.optionGroupWrapper,
                                        isEditingCategory(categoryIdx) &&
                                        optionGroup.values.length > 1
                                            ? classes.optionGroup
                                            : null,
                                    ])
                                        .compact()
                                        .join(" ")}
                                >
                                    <OptionGroup
                                        isEditing={isEditingCategory(categoryIdx)}
                                        basePath={[...basePath, categoryIdx, "options", groupIndex]}
                                        update={update}
                                        optionGroup={optionGroup}
                                    />
                                </div>
                            ))}
                            <IconButton
                                onClick={toggleEdit([antigenCode, dataElementIdx, categoryIdx])}
                                aria-label={i18n.t("Edit")}
                            >
                                <Icon
                                    color={isEditingCategory(categoryIdx) ? "primary" : "secondary"}
                                >
                                    edit
                                </Icon>
                            </IconButton>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const styles = (_theme: Theme) =>
    createStyles({
        categories: {
            marginLeft: 40,
        },
        categoriesWrapper: {
            display: "flex",
        },
        categoryWrapper: {
            display: "flex",
        },
        optionGroupWrapper: {
            textAlign: "center",
        },
        optionGroup: {
            border: "1px solid #CCC",
            paddingLeft: 7,
            paddingRight: 7,
            paddingBottom: 5,
            marginRight: 5,
        },
    });

export default withStyles(styles)(DataElement);
