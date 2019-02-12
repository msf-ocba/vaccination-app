import * as DataSets from "../DataSets";
import { getD2Stub } from "utils/testing";

const expectedFields = [
    "id",
    "name",
    "displayName",
    "shortName",
    "created",
    "lastUpdated",
    "externalAccess",
    "publicAccess",
    "userAccesses",
    "userGroupAccesses",
    "user",
    "access",
    "attributeValues",
    "href",
];

describe("DataSets", () => {
    describe("get", () => {
        describe("without filters nor pagination", () => {
            it("returns datasets", async () => {
                const d2 = getD2Stub({ models: { dataSets: { list: jest.fn() } } });
                await DataSets.get(d2, {}, {});

                expect(d2.models.dataSets.list).toHaveBeenCalledWith({
                    fields: expectedFields,
                    order: undefined,
                    page: undefined,
                    pageSize: 20,
                });
            });
        });

        describe("with filters and paginations", () => {
            it("returns datasets", async () => {
                const listMock = jest.fn();
                const d2 = getD2Stub({
                    currentUser: { id: "b123123123" },
                    models: { dataSets: { list: listMock } },
                });
                await DataSets.get(
                    d2,
                    {
                        searchValue: "abc",
                        showOnlyUserCampaigns: true,
                    },
                    {
                        page: 2,
                        pageSize: 10,
                        sorting: ["name", "desc"],
                    }
                );

                expect(listMock).toHaveBeenCalledWith({
                    fields: expectedFields,
                    order: "name:idesc",
                    page: 2,
                    pageSize: 10,
                    filter: ["displayName:ilike:abc", "user.id:eq:b123123123"],
                });
            });
        });
    });
});
