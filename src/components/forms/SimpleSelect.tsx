import React, { SFC } from "react";
import { Select, MenuItem } from "@material-ui/core";

interface SimpleSelectProps {
    value: string;
    options: Array<{ text: string; value: string }>;
    onChange: (value: string) => void;
}

const SimpleSelect: SFC<SimpleSelectProps> = ({ value, options, onChange }) => {
    const _onChange = (ev: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(ev.target.value);
    };

    return (
        <Select value={value} onChange={_onChange}>
            {options.map(option => (
                <MenuItem key={option.value} value={option.value}>
                    {option.text}
                </MenuItem>
            ))}
        </Select>
    );
};

export default SimpleSelect;
