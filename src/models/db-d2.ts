import { D2, D2Api } from './d2.types';
import { Db, OrganisationUnit, PaginatedObjects } from './db.types';
import _ from 'lodash';

export default class DbD2 implements Db {
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
}
