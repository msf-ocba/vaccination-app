import React, { SFC } from "react";
import { FormControlLabel, Checkbox } from "@material-ui/core";

interface CheckboxProps {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

const SimpleCheckbox: SFC<CheckboxProps> = props => {
    const { checked, onChange, label, disabled } = props;
    const _onChange = (ev: React.FormEvent<HTMLInputElement>) => onChange(ev.currentTarget.checked);

    return (
        <FormControlLabel
            control={<Checkbox checked={checked} onChange={_onChange} disabled={disabled} />}
            label={label}
        />
    );
};

export default SimpleCheckbox;
