describe("Campaign configurator - Create", () => {
    before(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("Campaign Configurator").click();
        cy.get("[data-test=create-campaign]").click();
    });

    beforeEach(() => {});

    it("gets data from the user", () => {
        cy.contains("New vaccination campaign");
        cy.contains("For all organisation units");

        cy.contains("Next").click();
        cy.contains("Select at least one organisation unit");

        const onlyLevel6Msg = "Only organisation units of level 6 can be selected";

        cy.wait(1000);

        selectOrgUnit("MSF");
        cy.contains(onlyLevel6Msg);

        selectOrgUnit("OCBA");
        cy.contains(onlyLevel6Msg);
        expandOrgUnit("OCBA");

        selectOrgUnit("ANGOLA");
        cy.contains(onlyLevel6Msg);
        expandOrgUnit("ANGOLA");

        selectOrgUnit("HUAMBO");
        cy.contains(onlyLevel6Msg);
        expandOrgUnit("HUAMBO");

        selectOrgUnit("Hospital central de Huambo");
        cy.contains(onlyLevel6Msg);
        expandOrgUnit("Hospital central de Huambo");

        selectOrgUnit("Emergency Room");
        selectOrgUnit("Paediatric Ward");

        cy.contains("Next").click();

        cy.get("[data-test-current=true]").contains("Save");
        cy.contains("Organisation Units");
        cy.contains(
            [
                "MSF-OCBA-ANGOLA-HUAMBO, Malaria outbreak-Hospital central de Huambo-Emergency Room",
                "MSF-OCBA-ANGOLA-HUAMBO, Malaria outbreak-Hospital central de Huambo-Paediatric Ward",
            ].join(", ")
        );

        cy.contains("Save").click();
    });
});

function expandOrgUnit(label) {
    cy.contains(label)
        .parents(".label")
        .prev()
        .click();
}

function selectOrgUnit(label) {
    cy.contains(label)
        .prev()
        .click();
}
