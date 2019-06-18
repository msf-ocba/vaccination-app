import moment from "moment";
import _ from "lodash";
import { getApiUrl } from "../../support/utils";

describe("Campaign configuration - Create", () => {
    before(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("Campaign Configuration").click();
        cy.get("[data-test=list-action-bar]").click();
    });

    after(() => {
        deleteAllTestResources();
    });

    it("gets data from the user", () => {
        cy.contains("New vaccination campaign");

        // General Info step
        waitForStepChange("General info");
        cy.contains("Next").click();
        cy.contains("Field name cannot be blank");

        cy.get("[data-field='name']").type("Test_vaccination_campaign_cypress");
        cy.contains("Start Date").click({ force: true });
        clickDay(11);

        cy.contains("End Date").click({ force: true });
        clickDay(13);

        cy.contains("Next").click();

        // Organisation Units Step
        cy.contains(
            "Select the health facilities or health area where the campaign will be implemented"
        );

        cy.get("[data-field='teams']").type(1);

        cy.contains("Next").click();
        cy.contains("Select at least one organisation unit");

        expandOrgUnit("OCBA");
        expandOrgUnit("ETHIOPIA");
        expandOrgUnit("ETHIOPIA, MERT");
        selectOrgUnit("Cholera Intervention Addis 2016");

        cy.contains("Next").click();

        // Antigens selections
        waitForStepChange("Antigen selection");
        cy.contains("Next").click();
        cy.contains("Select at least one antigen");

        selectAntigen("Measles");

        cy.contains("Next").click();

        // Disaggregation

        waitForStepChange("Configure Indicators");
        cy.contains("Measles");

        cy.contains("Next").click();

        // Target population
        waitForStepChange("Target Population");
        cy.contains("Cholera Intervention Addis 2016");

        cy.get("[test-total-population=0] [aria-label=Edit]").click();
        cy.get("[test-total-population=0] input")
            .clear()
            .type(1000);

        cy.get("[test-population-distribution=0] [aria-label=Edit] :first").click();
        cy.get("[test-population-distribution=0] input").each(($el, idx) => {
            cy.wrap($el)
                .clear()
                .type(idx + 1);
        });
        cy.get("#root")
            .contains("Next")
            .click();

        // Save step

        waitForStepChange("Save");
        cy.get("[data-test-current=true]").contains("Save");

        cy.contains("Name");
        cy.contains("Test_vaccination_campaign_cypress");

        cy.contains("Period dates");
        const now = moment();
        const expectedDataStart = now.set("date", 11).format("LL");
        const expectedDataEnd = now.set("date", 13).format("LL");
        cy.contains(`${expectedDataStart} -> ${expectedDataEnd}`);

        cy.contains("Antigens");
        cy.contains("Measles");
        cy.contains("Cholera");

        cy.contains("Organisation Units");
        cy.contains("MSF -> OCBA -> ETHIOPIA -> ETHIOPIA, MERT -> Cholera Intervention Addis 2016");

        cy.route("POST", "/api/metadata").as("metadataRequest");
        cy.get("[data-wizard-contents] button")
            .contains("Save")
            .click();

        cy.wait("@metadataRequest");
        cy.contains("Campaign created");
    });
});

function expandOrgUnit(label) {
    cy.server()
        .route("GET", "/api/organisationUnits/*")
        .as("getChildrenOrgUnits");
    cy.get("[data-wizard-contents]")
        .contains(label)
        .parents(".label")
        .prev()
        .click();
    cy.wait("@getChildrenOrgUnits");
}

function selectOrgUnit(label) {
    cy.contains(label)
        .prev()
        .click();
    cy.contains(label)
        .should("have.css", "color")
        .and("not.equal", "rgba(0, 0, 0, 0.87)");
}

function clickDay(dayOfMonth) {
    cy.xpath(`//span[contains(text(), '${dayOfMonth}')]`).then(spans => {
        const span = spans[spans.length - 1];
        if (span && span.parentElement) {
            span.parentElement.click();
        }
    });

    cy.wait(100); // eslint-disable-line cypress/no-unnecessary-waiting
}

function selectAntigen(label) {
    cy.get("[data-multi-selector] > div > div > div select:first").select(label);
    cy.get("[data-multi-selector] > div > div > div:nth-child(2)")
        .contains("→")
        .click();
}

function waitForStepChange(stepName) {
    cy.contains(stepName).should("have.class", "current-step");
}

function deleteAllTestResources() {
    cy.request({
        method: "GET",
        url: getApiUrl(
            "/dataSets?filter=name:like:Test_vaccination_campaign_cypress&fields=:owner,attributeValues[attribute[id,code],value]"
        ),
        failOnStatusCode: false,
    }).then(({ body: { dataSets } }) => {
        cy.request({
            method: "GET",
            url: getApiUrl("/categoryOptions?filter=name:like:Test_vaccination_campaign_cypress"),
        }).then(({ body: { categoryOptions } }) => {
            const dashboardId = _(dataSets[0].attributeValues)
                .filter(attrVal => attrVal.attribute.code === "RVC_DASHBOARD_ID")
                .map(attributeValue => attributeValue.value)
                .value();

            cy.request({
                method: "GET",
                url: getApiUrl(`/dashboards/${dashboardId[0]}`),
                failOnStatusCode: false,
            }).then(({ body: dashboard }) => {
                const resources = _(dashboard.dashboardItems)
                    .flatMap(item => [
                        { model: "charts", ref: item.chart },
                        { model: "reportTables", ref: item.reportTable },
                        { model: "maps", ref: item.map },
                    ])
                    .map(({ model, ref }) => (ref ? { model, id: ref.id } : null))
                    .compact()
                    .value();
                // Teams (categoryOptions) must be deleted last
                const allResources = _.concat(
                    [{ model: "dataSets", id: dataSets[0].id }],
                    [{ model: "dashboards", id: dashboardId[0] }],
                    resources,
                    [{ model: "categoryOptions", id: categoryOptions[0].id }]
                );

                deleteMany(allResources);
            });
        });
    });
}

function deleteMany(modelReferences) {
    modelReferences.forEach(({ model, id }) => {
        cy.request({
            method: "DELETE",
            url: getApiUrl(`/${model}/${id}`),
            failOnStatusCode: false,
        });
    });
}
