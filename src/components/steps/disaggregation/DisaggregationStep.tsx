import React, { SFC } from "react";
import _ from "lodash";
import { withStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import {
    Checkbox,
    FormControlLabel,
    createStyles,
    WithStyles,
    Theme,
    Select,
    MenuItem,
} from "@material-ui/core";

import { MuiThemeProvider, createMuiTheme } from "@material-ui/core";

import Spinner from "../../spinner/Spinner";
import { D2 } from "../../../models/d2.types";
import Campaign, { AntigenDisaggregationInfo } from "../../../models/campaign";
import { memoize } from "../../../utils/memoize";
import { muiTheme } from "../../../themes/dhis2.theme";

const styles = (_theme: Theme) =>
    createStyles({
        categories: {
            marginLeft: 20,
        },
        optionGroup: {
            border: "1px solid grey",
            padding: 7,
            marginRight: 5,
        },
        antigenInner: {
            marginLeft: 20,
        },
    });

interface MyCheckboxProps {
    label: string;
    checked: boolean;
    onChange?: (checked: boolean) => void;
    disabled?: boolean;
}

const MyCheckbox: SFC<MyCheckboxProps> = ({ checked, onChange, label, disabled }) => {
    const _onChange = (ev: React.FormEvent<HTMLInputElement>) =>
        onChange ? onChange(ev.currentTarget.checked) : undefined;

    return (
        <React.Fragment>
            <FormControlLabel
                control={<Checkbox checked={checked} onChange={_onChange} disabled={disabled} />}
                label={disabled ? "" : label}
            />
            {disabled && <span style={{ marginLeft: -15 }}>{label}</span>}
        </React.Fragment>
    );
};

interface MySelectProps {
    value: string;
    options: Array<{ text: string; value: string }>;
    onChange: (value: string) => void;
}

const MySelect: SFC<MySelectProps> = ({ value, options, onChange }) => {
    const _onChange = (ev: React.ChangeEvent<HTMLSelectElement>) => {
        console.log({ ev });
        onChange(ev.target.value);
    };

    return (
        <React.Fragment>
            <Select value={value} onChange={_onChange}>
                {options.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                        {option.text}
                    </MenuItem>
                ))}
            </Select>
        </React.Fragment>
    );
};

//

interface DisaggregationStepProps extends WithStyles<typeof styles> {
    d2: D2;
    campaign: Campaign;
}

interface DisaggregationStepState {
    dataByAntigen: AntigenDisaggregationInfo[];
}

class DisaggregationStep extends React.Component<DisaggregationStepProps, DisaggregationStepState> {
    state: DisaggregationStepState = {
        dataByAntigen: [],
    };

    async componentDidMount() {
        const { campaign } = this.props;
        const dataByAntigen = await campaign.getAntigensDisaggregation();
        this.setState({ dataByAntigen });
    }

    update = memoize((path: Array<number | string>) => (newValue: any) => {
        const dataByAntigenUpdated = _.set(this.state.dataByAntigen, path, newValue);
        return this.setState({ dataByAntigen: dataByAntigenUpdated });
    });

    renderDataElement = (
        antigenIdx: number,
        dataElementIdx: number,
        categories: AntigenDisaggregationInfo["dataElements"][0]["categories"]
    ) => {
        const { classes } = this.props;

        return (
            <div className={classes.categories}>
                {categories.map((category, categoryIdx) => (
                    <div key={category.code}>
                        <MyCheckbox
                            key={category.code}
                            checked={category.selected}
                            disabled={!category.optional}
                            label={category.name}
                            onChange={this.update([
                                antigenIdx,
                                "dataElements",
                                dataElementIdx,
                                "categories",
                                categoryIdx,
                                "selected",
                            ])}
                        />

                        {category.selected &&
                            category.options.map((optionGroup, optionGroupIndex) => (
                                <span
                                    key={optionGroupIndex}
                                    className={
                                        optionGroup.values.length > 1
                                            ? classes.optionGroup
                                            : undefined
                                    }
                                >
                                    {optionGroup.values.length > 1 && (
                                        <MySelect
                                            value={optionGroup.indexSelected.toString()}
                                            onChange={this.update([
                                                antigenIdx,
                                                "dataElements",
                                                dataElementIdx,
                                                "categories",
                                                categoryIdx,
                                                "options",
                                                optionGroupIndex,
                                                "indexSelected",
                                            ])}
                                            options={optionGroup.values.map((og, index) => ({
                                                text: og.map(o => o.name).join(" / "),
                                                value: index.toString(),
                                            }))}
                                        />
                                    )}

                                    {optionGroup.values[optionGroup.indexSelected].map(
                                        (option, optionIdx) => (
                                            <MyCheckbox
                                                key={option.name}
                                                checked={option.selected}
                                                label={option.name}
                                                onChange={this.update([
                                                    antigenIdx,
                                                    "dataElements",
                                                    dataElementIdx,
                                                    "categories",
                                                    categoryIdx,
                                                    "options",
                                                    optionGroupIndex,
                                                    "values",
                                                    optionGroup.indexSelected,
                                                    optionIdx,
                                                    "selected",
                                                ])}
                                            />
                                        )
                                    )}
                                </span>
                            ))}
                    </div>
                ))}
            </div>
        );
    };

    render() {
        const { classes } = this.props;
        const { dataByAntigen } = this.state;

        if (dataByAntigen.length === 0) return <Spinner isLoading={true} />;
        console.log({ dataByAntigen });

        return (
            <MuiThemeProvider theme={materialTheme}>
                <React.Fragment>
                    {dataByAntigen.map((antigen, antigenIdx) => (
                        <div key={antigen.name}>
                            <Typography variant="h4" gutterBottom>
                                {antigen.name}
                            </Typography>

                            <div key={name} className={classes.antigenInner}>
                                {antigen.dataElements.map((dataElement, dataElementIdx) => (
                                    <div key={dataElement.name}>
                                        <MyCheckbox
                                            checked={dataElement.selected}
                                            disabled={!dataElement.optional}
                                            onChange={this.update([
                                                antigenIdx,
                                                "dataElements",
                                                dataElementIdx,
                                                "selected",
                                            ])}
                                            label={dataElement.name}
                                        />

                                        {dataElement.selected &&
                                            this.renderDataElement(
                                                antigenIdx,
                                                dataElementIdx,
                                                dataElement.categories
                                            )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </React.Fragment>
            </MuiThemeProvider>
        );
    }
}

const materialTheme = createMuiTheme({
    ...muiTheme,
    typography: {
        useNextVariants: true,
    },
    /*overrides: {
        MuiCheckbox: {
            colorSecondary: {
                "&$disabled": {
                    color: "#444",
                },
            },
        },
    },*/
});

export default withStyles(styles)(DisaggregationStep);
//export default DisaggregationStep;
