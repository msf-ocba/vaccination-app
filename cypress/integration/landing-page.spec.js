/// <reference types="Cypress" />

context("Landing page", () => {
    before(() => {
        cy.login("admin");
        cy.loadPage();
    });

    beforeEach(() => {
        cy.login("admin");
    });

    it("has page title", () => {
        cy.title().should("equal", "Vaccination App");
    });

    it("shows 4 pages of the application", () => {
        cy.get('[data-test="pages"]')
            .should("have.length", 1)
            .should("be.visible");

        cy.contains("Campaign Configurator");
        cy.contains("Data Entry");
        cy.contains("Dashboard");
        cy.contains("Maintenance");
    });
});
