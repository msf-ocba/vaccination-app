import React from "react";
import PropTypes from "prop-types";
import "./SimpleCheckBox.css";

export default function SimpleCheckBox(props) {
    const { onClick, checked } = props;

    return (
        <span onClick={onClick}>
            <input type="checkbox" readOnly={true} checked={checked} className="simple-checkbox" />
            <span />
        </span>
    );
}

SimpleCheckBox.propTypes = {
    onClick: PropTypes.func.isRequired,
    checked: PropTypes.bool.isRequired,
};
