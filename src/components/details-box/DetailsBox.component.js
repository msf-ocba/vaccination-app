import React from "react";
import PropTypes from "prop-types";
import classes from "classnames";
import i18n from "@dhis2/d2-i18n";
import FontIcon from "material-ui/FontIcon";
import "./DetailsBox.scss";
import { formatDateLong } from "utils/date.js";

class DetailsBox extends React.Component {
    static propTypes = {
        fields: PropTypes.arrayOf(
            PropTypes.shape({
                key: PropTypes.string.isRequired,
                text: PropTypes.string.isRequired,
            })
        ),
        showDetailBox: PropTypes.bool,
        source: PropTypes.object,
        onClose: PropTypes.func,
    };

    static defaultProps = {
        fields: [
            { key: "name", text: i18n.t("Name") },
            { key: "shortName", text: i18n.t("Short name") },
            { key: "code", text: i18n.t("Code") },
            { key: "displayDescription", text: i18n.t("Display description") },
            { key: "created", text: i18n.t("Created") },
            { key: "lastUpdated", text: i18n.t("Last update") },
            { key: "id", text: i18n.t("Id") },
            { key: "href", text: i18n.t("API link") },
        ],
        showDetailBox: false,
        onClose: () => {},
    };

    getDetailBoxContent() {
        if (!this.props.source) {
            return <div className="detail-box__status">Loading details...</div>;
        }

        return this.props.fields.filter(field => this.props.source[field.key]).map(field => {
            const fieldName = field.key;
            const valueToRender = this.getValueToRender(fieldName, this.props.source[fieldName]);

            return (
                <div key={fieldName} className="detail-field">
                    <div className={`detail-field__label detail-field__${fieldName}-label`}>
                        {field.text}
                    </div>

                    <div className={`detail-field__value detail-field__${fieldName}`}>
                        {valueToRender}
                    </div>
                </div>
            );
        });
    }

    getValueToRender(fieldName, value) {
        if (Array.isArray(value) && value.length) {
            const namesToDisplay = value
                .map(v => (v.displayName ? v.displayName : v.name))
                .filter(name => name);

            return (
                <ul>
                    {namesToDisplay.map(name => (
                        <li key={name}>{name}</li>
                    ))}
                </ul>
            );
        }

        if (fieldName === "created" || fieldName === "lastUpdated") {
            return formatDateLong(value);
        }

        if (fieldName === "href") {
            // Suffix the url with the .json extension to always get the json representation of the api resource
            return (
                <a
                    rel="noopener noreferrer"
                    style={{ wordBreak: "break-all" }}
                    href={`${value}.json`}
                    target="_blank"
                >
                    {value}
                </a>
            );
        }

        return value;
    }

    render() {
        const classList = classes("details-box");

        if (this.props.showDetailBox === false) {
            return null;
        }

        return (
            <div className={classList}>
                <FontIcon
                    className="details-box__close-button material-icons"
                    onClick={this.props.onClose}
                >
                    close
                </FontIcon>
                <div>{this.getDetailBoxContent()}</div>
            </div>
        );
    }
}

export default DetailsBox;
