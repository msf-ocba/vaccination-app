import Campaign from "../campaign";
import DbD2 from "../db-d2";
import { getD2Stub } from "../../utils/testing";
import _ from "lodash";

const d2 = getD2Stub();
const db = new DbD2(d2);
const campaign = Campaign.create(db);

describe("Campaign", () => {
    describe("Validations", () => {
        it("requires a name", () => {
            const messages = campaign.validate();
            expect(messages).toEqual(
                expect.objectContaining({
                    name: {
                        key: "cannot_be_blank",
                        namespace: { field: "name" },
                    },
                })
            );
        });

        it("requires at least one orgunit", () => {
            const messages = campaign.validate();
            expect(messages).toEqual(
                expect.objectContaining({
                    organisationUnits: [{ key: "no_organisation_units_selected" }],
                })
            );
        });

        it("requires at orgunits of level 6", () => {
            const ids = [
                "zOyMxdCLXBM",
                "G7g4TvbjFlX",
                "lmelleX7G5X",
                "ll8gkZ6djJG",
                "RlnRXcjKY69",
                "pmROYBZA9SI",
                "AxkRidrb0E5",
                "w82ydGtPAE0",
                "vB9T3dc2fqY",
                "qgmBzwyBhcq",
            ];
            _(1)
                .range(10)
                .forEach(level => {
                    const path =
                        "/" +
                        _(ids)
                            .take(level)
                            .join("/");
                    const campaignWithOrgUnit = campaign.setOrganisationUnits([
                        {
                            id:
                                _(path)
                                    .split("/")
                                    .last() || "",
                            path: path,
                        },
                    ]);
                    const messages = campaignWithOrgUnit.validate();

                    if (level == 6) {
                        expect(messages).toEqual(
                            expect.objectContaining({
                                organisationUnits: [],
                            })
                        );
                    } else {
                        expect(messages).toEqual(
                            expect.objectContaining({
                                organisationUnits: [
                                    {
                                        key: "organisation_units_only_of_levels",
                                        namespace: { levels: "6" },
                                    },
                                ],
                            })
                        );
                    }
                });
        });
    });
});

export {};
