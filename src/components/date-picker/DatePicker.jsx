import React from "react";
import PropTypes from "prop-types";
import moment from "moment";
import MomentUtils from "@date-io/moment";
import { MuiPickersUtilsProvider, DatePicker as MuiDatePicker } from "material-ui-pickers";
import { MuiThemeProvider, createMuiTheme } from "@material-ui/core";
import cyan from "@material-ui/core/colors/cyan";

class DatePicker extends React.PureComponent {
    static propTypes = {
        label: PropTypes.string.isRequired,
        value: PropTypes.object,
        onChange: PropTypes.func.isRequired,
    };

    render() {
        const { label, value, onChange } = this.props;
        const format = moment.localeData()._longDateFormat.LL;

        return (
            <MuiThemeProvider theme={materialTheme}>
                <MuiPickersUtilsProvider utils={MomentUtils}>
                    <MuiDatePicker
                        margin="normal"
                        label={label}
                        value={value}
                        format={format}
                        onChange={onChange}
                        clearable={true}
                        autoOk={true}
                    />
                </MuiPickersUtilsProvider>
            </MuiThemeProvider>
        );
    }
}

const grey = "#0000004d";

const materialTheme = createMuiTheme({
    typography: {
        useNextVariants: true,
    },
    overrides: {
        MuiFormLabel: {
            root: {
                color: grey,
                "&$focused": {
                    color: cyan["500"],
                },
            },
        },
        MuiInput: {
            root: {
                color: grey,
            },
            input: {
                color: "#000000de",
            },
            underline: {
                "&&&&:hover:before": {
                    borderBottom: `1px solid #e0e0e0`,
                },
                "&:hover:not($disabled):before": {
                    borderBottom: `1px solid ${grey}`,
                },
                "&:after": {
                    borderBottom: `2px solid ${cyan["500"]}`,
                },
                "&:before": {
                    borderBottom: `1px solid #e0e0e0`,
                },
            },
        },
    },
});

export default DatePicker;
