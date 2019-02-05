import { Db, OrganisationUnit, PaginatedObjects as Paginated, OrganisationUnitPathOnly } from "./db.types";
import _ from 'lodash';

export interface Data {
    organisationUnits: OrganisationUnitPathOnly[],
}

export default class Campaign {
    selectableLevels: number[] = [6];

    constructor(public db: Db, public data: Data) {
    }

    public static create(db: Db): Campaign {
        const initialData = {
            organisationUnits: [],
        };
        return new Campaign(db, initialData);
    }

    public validate() {
        const { organisationUnits } = this.data;

        const allInLevels = _(organisationUnits).every(ou =>
            _(this.selectableLevels).includes(_(ou.path).countBy().get("/") || 0));

        return _.pickBy({
            organisationUnits: _.compact([
                allInLevels ? null : {
                    key: "organisation_units_only_of_levels",
                    namespace: {levels: this.selectableLevels.join("/")},
                },
                _(organisationUnits).isEmpty() ? {key: "no_organisation_units_selected"} : null,
            ]),
        });
    }

    public getOrganisationUnits(): OrganisationUnitPathOnly[] {
        return this.data.organisationUnits;
    }

    public async getOrganisationUnitsFullName(): Promise<Paginated<string>> {
        const ids = this.data.organisationUnits.map(ou => ou.id);
        const {pager, objects} = await this.db.getOrganisationUnitsFromIds(ids);
        const names = objects.map(ou =>
            (ou.ancestors || []).map(oua => oua.displayName).concat([ou.displayName]).join("-")
        );
        return {pager, objects: names};
    }

    public setOrganisationUnits(organisationUnits: OrganisationUnit[]): Campaign {
        return new Campaign(this.db, {...this.data, organisationUnits});
    }
}
