import _ from "lodash";
import i18n from "@dhis2/d2-i18n";

const translations = {
    no_organisation_units_selected: () => i18n.t("Select at least one organisation unit"),
    organisation_units_only_of_levels: namespace =>
        i18n.t("Only organisation units of level {{levels}} can be selected", namespace),

    cannot_be_blank: namespace => i18n.t("Field {{field}} cannot be blank", namespace),
    cannot_be_blank_if_other_set: namespace =>
        i18n.t("Field {{field}} cannot be blank if field {{other}} is set", namespace),

    no_antigens_selected: () => i18n.t("Select at least one antigen"),
};

export function getValidationMessages(campaign, validationKeys) {
    const validationObj = campaign.validate();

    return _(validationObj)
        .at(validationKeys)
        .flatten()
        .compact()
        .map(error => {
            const translation = translations[error.key];
            if (translation) {
                return i18n.t(translation(error.namespace));
            } else {
                return `Missing translations: ${error.key}`;
            }
        })
        .value();
}
