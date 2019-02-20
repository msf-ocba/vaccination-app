import { list } from "../datasets";
import { getD2Stub } from "../../utils/testing";
import { metadataConfig } from "../campaign";

const expectedFields = [
    "id",
    "name",
    "code",
    "displayName",
    "displayDescription",
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

const emptyCollection = { pager: {}, toArray: () => [] };
const listMock = jest.fn(() => Promise.resolve(emptyCollection));

describe("DataSets", () => {
    describe("get", () => {
        describe("without filters nor pagination", () => {
            it("returns datasets", async () => {
                const d2 = getD2Stub({ models: { dataSets: { list: listMock } } });
                await list(d2, {}, {});

                expect(d2.models.dataSets.list).toHaveBeenNthCalledWith(1, {
                    fields: ["id", "attributeValues[value, attribute[code]]"],
                    paging: false,
                    filter: `attributeValues.attribute.code:eq:${
                        metadataConfig.attibuteCodeForApp
                    }`,
                });

                expect(d2.models.dataSets.list).toHaveBeenLastCalledWith({
                    fields: expectedFields,
                    order: undefined,
                    page: undefined,
                    pageSize: 20,
                    filter: ["id:in:[]"],
                });
                expect(d2.models.dataSets.list).toHaveBeenCalledTimes(2);
            });
        });

        describe("with filters and paginations", () => {
            it("returns datasets", async () => {
                const d2 = getD2Stub({
                    currentUser: { id: "b123123123" },
                    models: { dataSets: { list: listMock } },
                });
                const filters = {
                    search: "abc",
                    showOnlyUserCampaigns: true,
                };
                const pagination = {
                    page: 2,
                    pageSize: 10,
                    sorting: ["displayName", "desc"],
                };
                await list(d2, filters, pagination);

                expect(d2.models.dataSets.list).toHaveBeenCalledWith({
                    fields: expectedFields,
                    order: "displayName:idesc",
                    page: 2,
                    pageSize: 10,
                    filter: ["displayName:ilike:abc", "user.id:eq:b123123123", "id:in:[]"],
                });
            });
        });
    });
});
