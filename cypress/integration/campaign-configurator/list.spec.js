describe("Campaign configurator - List page", () => {
    before(() => {
        cy.login("admin");
        cy.loadPage("/campaign-configurator");
    });

    beforeEach(() => {
        cy.login("admin");
    });

    it("should have the filter only my campaign set by default", () => {
        cy.get("[data-test='only-my-campaigns']").should("be.checked");
    });

    it("shows list of user campaigns", () => {
        cy.get(".data-table__rows__row").should("have.length", 10);

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
        cy.wait(1000);

        cy.contains("Details");
        cy.contains("Edit");
        cy.contains("Share");
        cy.contains("Delete");
        cy.contains("Go to Data Entry");
        cy.contains("Go to Dashboard");
        cy.contains("Download data");

        cy.contains("Details").click();
    });

    context("Unset filter only-my-campaigns", () => {
        it("shows list of user dataset sorted alphabetically", () => {
            cy.get("[data-test='only-my-campaigns']").uncheck();

            cy.get(".data-table__rows__row").should("have.length", 10);

            cy.get(".data-table__rows > :nth-child(1) > :nth-child(2) span").should(
                "have.text",
                "Cholera Outbreak - Daily "
            );

            cy.get(".data-table__rows > :nth-child(2) > :nth-child(2) span").should(
                "not.have.text",
                "Community-based Activities - Weekly"
            );
        });

        context("Use filter box", () => {
            it("can filter datasets by name (case insensitive)", () => {
                cy.get("[data-test='search']")
                    .clear()
                    .type("meningitis");
                cy.wait(500);

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
        });

        context("Click name column", () => {
            it("shows list of user dataset sorted alphabetically desc", () => {
                cy.get("[data-test='search']").clear();
                cy.contains("Name").click();
                cy.wait(1000);

                cy.get(".data-table__rows__row").should("have.length", 10);

                cy.get(".data-table__rows > :nth-child(1) > :nth-child(2) span").should(
                    "have.text",
                    "Viral Haemorrhagic Fever - Weekly"
                );
            });
        });
    });
});
