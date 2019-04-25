/* Disable: TODO: setup /more robust
describe("Campaign configuration - List page", () => {
    beforeEach(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("Campaign Configuration").click();
    });

    it("should have the filter only my campaign set by default", () => {
        cy.get("[data-test='only-my-campaigns']").should("be.checked");
    });

    it("shows list of user campaigns", () => {
        cy.get(".data-table__rows__row").should("have.length", 20);

        cy.get(".data-table__rows > :nth-child(1) > :nth-child(2) span").should(
            "have.text",
            "Cholera Outbreak - Daily "
        );
    });

    it("opens details window when mouse clicked", () => {
        cy.contains("Cholera Outbreak - Daily ").click();

        cy.contains("Short name");
        cy.contains("v6hCzYgjqq3");
    });

    it("opens context window when right button mouse is clicked", () => {
        cy.contains("Cholera Outbreak - Daily ")
            .first()
            .trigger("contextmenu");

        cy.contains("Details");
        cy.contains("Edit");
        cy.contains("Share");
        cy.contains("Delete");
        cy.contains("Go to Data Entry");
        cy.contains("Go to Dashboard");
        cy.contains("Download data");

        cy.contains("Details").click();
    });

    it("shows list of user dataset sorted alphabetically", () => {
        cy.get("[data-test='only-my-campaigns']").uncheck();

        cy.get(".data-table__rows__row").should("have.length", 20);

        cy.get(".data-table__rows > :nth-child(1) > :nth-child(2) span").should(
            "have.text",
            "Cholera Outbreak - Daily "
        );

        cy.get(".data-table__rows > :nth-child(2) > :nth-child(2) span").should(
            "not.have.text",
            "Community-based Activities - Weekly"
        );
    });

    it("can filter datasets by name (case insensitive)", () => {
        cy.get("[data-test='only-my-campaigns']").uncheck();

        cy.server()
            .route("GET", "/api/dataSets**")
            .as("getDataSets");
        cy.get("[data-test='search']")
            .clear()
            .type("meningitis");
        cy.wait("@getDataSets");
        cy.get(".data-table__rows__row").should("have.length", 2);

        cy.get(".data-table__rows > :nth-child(1) > :nth-child(2) span").should(
            "have.text",
            "Meningitis Outbreak - Daily"
        );

        cy.get(".data-table__rows > :nth-child(2) > :nth-child(2) span").should(
            "have.text",
            "Meningitis Outbreak - Weekly"
        );
    });

    it("shows list of user dataset sorted alphabetically desc", () => {
        cy.get("[data-test='search']").clear();
        cy.server()
            .route("GET", "/api/dataSets*")
            .as("getDataSets");
        cy.contains("Name").click();
        cy.wait("@getDataSets");

        cy.get(".data-table__rows__row").should("have.length", 20);

        cy.get(".data-table__rows > :nth-child(1) > :nth-child(2) span").should(
            "have.text",
            "Vaccination Women - Weekly"
        );
    });
});
*/
