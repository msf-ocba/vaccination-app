import { Dictionary } from "lodash";
import { D2, D2Api } from './d2.types';
import { OrganisationUnit, PaginatedObjects, CategoryOption, Maybe, CategoryCombo, DataElementGroup, DataSet, MetadataResponse, Response, Metadata, Attribute, Ref } from './db.types';
import _ from 'lodash';
import { chart, reportTable } from './dashboard-items';

export default class DbD2 {
    d2: D2;
    api: D2Api;

    constructor(d2: D2) {
        this.d2 = d2;
        this.api = d2.Api.getApi();
    }

    public async getOrganisationUnitsFromIds(ids: string[]):
            Promise<PaginatedObjects<OrganisationUnit>> {
        const pageSize = 10;
        const { pager, organisationUnits } = await this.api.get("/organisationUnits", {
            paging: true,
            pageSize: pageSize,
            filter: [`id:in:[${_(ids).take(pageSize).join(',')}]`],
            fields: ["id", "displayName", "path", "level", "ancestors[id,displayName,path,level]"],
        });
        const newPager = {...pager, total: ids.length};
        return { pager: newPager, objects: organisationUnits };
    }

    public async getCategoryOptionsByCategoryCode(code: string): Promise<CategoryOption[]> {
        const { categories } = await this.api.get("/categories", {
            filter: [`code:in:[${code}]`],
            fields: ["categoryOptions[id,displayName,code]"],
        });

        if (_(categories).isEmpty()) {
            return [];
        } else {
            return _(categories[0].categoryOptions).sortBy("displayName").value();
        }
    }

    public async getCategoryCombosByCode(codes: string[]): Promise<CategoryCombo[]> {
        const { categoryCombos } = await this.api.get("/categoryCombos", {
            paging: false,
            filter: [`code:in:[${codes.join(",")}]`],
            fields: ["id,code,displayName"],
        });

        return categoryCombos;
    }

    public async getDataElementGroupsByCodes(codes: string[]): Promise<DataElementGroup[]> {
        const { dataElementGroups } = await this.api.get("/dataElementGroups", {
            filter: [`code:in:[${codes.join(",")}]`],
            fields: ["id,code,displayName,dataElements[id,code,displayName,categoryCombo[id,displayName,code]]"],
        });

        return dataElementGroups;
    }

    public async postMetadata(metadata: Metadata): Promise<MetadataResponse> {
        const result = await this.api.post("/metadata", metadata) as MetadataResponse;
        return result;

        /*
        if (result.status === "OK" && metadata.dataSets) {
            metadata.dataSets.map(dataSet => {})
            this.api.post("/metadata", metadata) as MetadataResponse;
        }
        */

    }

    public async getAttributeIdByCode(code: string): Promise<Attribute | undefined> {
        const { attributes } = await this.api.get("/attributes", {
            paging: true,
            pageSize: 1,
            filter: [`code:eq:${code}`],
            fields: ["id"],
        });
        return attributes[0];
    }

    public async createDashboard(name: String): Promise<Ref | undefined> {
        // For now, a chart is created from a genertic template and added to the dashboard
        const { response: { uid: chartId }} = await this.api.post("/charts", chart(name));
        const { response: { uid: reportTableId }} = await this.api.post("/reportTables", reportTable(name));
        const dashboard = {
            name: `${name}_DASHBOARD`,
            dashboardItems: [
                { id: chartId },
                { id: reportTableId },
            ]
        };
        const { response: { uid } } = await this.api.post("/dashboards", dashboard);
        console.log({ dashboardId: uid });
        return { id: uid };
    }
}
