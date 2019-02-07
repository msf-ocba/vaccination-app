import { Db, OrganisationUnit, PaginatedObjects, OrganisationUnitPathOnly } from "./db.types";
import _ from 'lodash';

export interface Data {
    name: string;
    organisationUnits: OrganisationUnitPathOnly[];
    startDate: Date | null;
    endDate: Date | null;
}

export default class Campaign {
    selectableLevels: number[] = [6];

    constructor(private db: Db, private data: Data) {
    }

    public static create(db: Db): Campaign {
        const initialData = {
            name: "",
            organisationUnits: [],
            startDate: null,
            endDate: null,
        };
        return new Campaign(db, initialData);
    }

    public validate() {
        const { organisationUnits, name, startDate, endDate } = this.data;

        const allOrgUnitsInAcceptedLevels = _(organisationUnits).every(ou =>
            _(this.selectableLevels).includes(_(ou.path).countBy().get("/") || 0));

        return _.pickBy({
            name: !name.trim() ? {
                key: "cannot_be_blank",
                namespace: {field: "name"}
            } : null,

            startDate: startDate && !endDate ? {
                key: "cannot_be_blank_if_other_set",
                namespace: {field: "startDate", other: "endDate"},
            } : null,

            endDate: endDate && !startDate ? {
                key: "cannot_be_blank_if_other_set",
                namespace: {field: "endDate", other: "startDate"},
            } : null,

            organisationUnits: _.compact([
                !allOrgUnitsInAcceptedLevels ? {
                    key: "organisation_units_only_of_levels",
                    namespace: {levels: this.selectableLevels.join("/")},
                } : null,
                _(organisationUnits).isEmpty() ? {key: "no_organisation_units_selected"} : null,
            ]),
        });
    }

    public async getOrganisationUnitsFullName(): Promise<PaginatedObjects<string>> {
        const ids = this.data.organisationUnits.map(ou => ou.id);
        const {pager, objects} = await this.db.getOrganisationUnitsFromIds(ids);
        const names = objects
            .map(ou => _(ou.ancestors || []).map("displayName").concat([ou.displayName]).join("-"));
        return {pager, objects: names};
    }

    public setOrganisationUnits(organisationUnits: OrganisationUnitPathOnly[]): Campaign {
        // Use orgUnits only with id/path, that's the only info we get from a orgunit-tree
        return new Campaign(this.db, {...this.data, organisationUnits});
    }

    public get organisationUnits(): OrganisationUnitPathOnly[] {
        return this.data.organisationUnits;
    }

    public setName(name: string): Campaign {
        return new Campaign(this.db, {...this.data, name});
    }

    public get name(): string {
        return this.data.name;
    }

    public setStartDate(startDate: Date | null): Campaign {
        return new Campaign(this.db, {...this.data, startDate});
    }

    public get startDate(): Date | null {
        return this.data.startDate;
    }

    public setEndDate(endDate: Date | null): Campaign {
        return new Campaign(this.db, {...this.data, endDate});
    }

    public get endDate(): Date | null {
        return this.data.endDate;
    }
}
