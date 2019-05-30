import React from "react";
import _ from "lodash";
import { TextField } from "@material-ui/core";

interface NumericFieldProps {
    className?: string;
    value?: number;
    onChange: (newValue: number | undefined) => void;
    inputRef?: React.Ref<any> | React.RefObject<any>;
    maxDecimals?: number;
}

interface NumericFieldState {
    localFieldValue: string;
    propValue: number | undefined;
}

export class NumericField extends React.Component<NumericFieldProps, NumericFieldState> {
    state = NumericField.getStateFromProps(this.props);

    static getStateFromProps(props: NumericFieldProps): NumericFieldState {
        return {
            localFieldValue: props.value ? props.value.toString() : "",
            propValue: props.value,
        };
    }

    public render() {
        const { className, inputRef } = this.props;
        const { localFieldValue } = this.state;

        return (
            <TextField
                className={className}
                value={localFieldValue}
                onChange={this.onChange}
                onBlur={this.onBlur}
                inputRef={inputRef}
            />
        );
    }

    static getDerivedStateFromProps(props: NumericFieldProps, state: NumericFieldState) {
        return props.value !== state.propValue ? NumericField.getStateFromProps(props) : null;
    }

    private onChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
        const { maxDecimals } = this.props;
        const value = ev.currentTarget.value;
        const hasCorrectDecimals =
            _.isUndefined(maxDecimals) ||
            _.isNaN(parseFloat(value)) ||
            (value.split(".")[1] || "").length <= maxDecimals;

        if (hasCorrectDecimals) {
            this.setState({ localFieldValue: value });
        }
    };

    private onBlur = () => {
        const { localFieldValue } = this.state;

        if (this.valueIsValid(localFieldValue)) {
            const value = parseFloat(localFieldValue);
            this.props.onChange(isNaN(value) ? undefined : value);
        } else {
            // If value is invalid, restore the previous one
            this.setState(NumericField.getStateFromProps(this.props));
        }
    };

    private valueIsValid(value: string) {
        return !isNaN(value as any);
    }
}
