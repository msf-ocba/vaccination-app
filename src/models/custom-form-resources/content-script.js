/* global $, _, dhis2 */

var getRealDimensions = function($el_, parent) {
    var $el = $($el_.get(0));

    if ($el.length === 0) {
        return { width: 0, height: 0 };
    } else {
        var $clone = $el
            .clone()
            .show()
            .css("visibility", "hidden")
            .appendTo(parent);
        var dimensions = {
            width: $clone.outerWidth(),
            height: $clone.outerHeight(),
        };
        $clone.remove();
        return dimensions;
    }
};

var processWideTables = function() {
    $("#contentDiv").show();
    const contentWidth = $(".ui-tabs-panel").width();
    console.log("Content box width:", contentWidth);

    $(".tableGroupWrapper")
        .get()
        .forEach(tableGroupWrapper => {
            const tableGroups = $(tableGroupWrapper)
                .find(".tableGroup")
                .get();

            if (tableGroups.length <= 1) return;

            /* Show contents temporally so we can get actual rendered width of tables */

            const groups = _.chain(tableGroups)
                .map(tableGroup => ({
                    element: tableGroup,
                    width: getRealDimensions($(tableGroup).find("table"), $("#contentDiv")).width,
                }))
                .sortBy(group => group.width)
                .reverse()
                .value();

            console.log(
                "Tables width: " +
                    groups.map((group, idx) => "idx=" + idx + " width=" + group.width).join(" - ")
            );

            const groupToShow = groups.find(group => group.width <= contentWidth) || groups[0];

            tableGroups.forEach(tableGroup => {
                if (tableGroup !== groupToShow.element) {
                    $(tableGroup).remove();
                }
            });
        });
    $("#contentDiv").hide();
};

var highlightDataElementRows = function() {
    var setClass = function(ev, className, isActive) {
        var tr = $(ev.currentTarget);
        var de_class = (tr.attr("class") || "").split(" ").filter(cl => cl.startsWith("de-"))[0];
        if (de_class) {
            var deId = de_class.split("-")[1];
            var el = $(".de-" + deId);
            el.toggleClass(className, isActive);
            if (tr.hasClass("secondary")) {
                var opacity = isActive ? 1 : 0;
                tr.find(".data-element")
                    .clearQueue()
                    .delay(500)
                    .animate({ opacity: opacity }, 100);
            }
        }
    };

    $("tr.derow")
        .mouseover(ev => setClass(ev, "hover", true))
        .mouseout(ev => setClass(ev, "hover", false))
        .focusin(ev => setClass(ev, "focus", true))
        .focusout(ev => setClass(ev, "focus", false));
};

var translate = function(options) {
    const translations = options.translations;
    const userSettings = dhis2.de.storageManager.getUserSettings();
    const currentLocale = userSettings ? userSettings.keyDbLocale : null;

    if (!currentLocale) return;

    $("*[data-translate='']")
        .get()
        .forEach(el_ => {
            const el = $(el_);
            const text = el.text();
            const translation = translations[text];
            if (translation) {
                const text2 = translation[currentLocale] || translation["en"] || text;
                el.text(text2);
            }
        });
};

var applyChangesToForm = function(options) {
    highlightDataElementRows();
    processWideTables();
    translate(options);
    $("#tabs").tabs();
    // Set full width to data elements columns after table width has been calculated
    $(".header-first-column").addClass("full-width");
};

var runValidations = function(options, ev, dataSetId, dataValue) {
    if (dataValue.de && options.dataElements[dataValue.de] === "RVC_AEFI") {
        // dhis2.de.validate(completeUncomplete, ignoreValidationSuccess, successCallback)
        dhis2.de.validate(false, true);
    }
};

/* Initialize a custom form. Options:
            translations: Dictionary<string, Dictionary<Locale, string>>
            dataElements: Dictionary<Id, Code>
    */
// eslint-disable-next-line no-unused-vars
function init(options) {
    $(document).on("dhis2.de.event.formLoaded", applyChangesToForm.bind(null, options));
    $(document).on("dhis2.de.event.dataValueSaved", runValidations.bind(null, options));
}

export {};
