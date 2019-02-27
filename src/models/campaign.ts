///<reference path="../types/d2.d.ts" />
import moment from 'moment';
import { generateUid } from "d2/uid";

import { MetadataResponse, Section, CategoryCombo, DataSet, Response } from './db.types';
import { PaginatedObjects, OrganisationUnitPathOnly, CategoryOption } from "./db.types";
import _ from '../utils/lodash';
import { getDaysRange } from '../utils/date';
import DbD2 from './db-d2';


export const metadataConfig = {
    categoryCodeForAntigens: "RVC_ANTIGENS",
    categoryComboCodeForTeams: "RVC_TEAMS",
    attibuteCodeForApp: "CREATED_BY_VACCINATION_APP",
    attributeCodeForDashboard: "DASHBOARD_ID",
};

export interface Data {
    name: string;
    organisationUnits: OrganisationUnitPathOnly[];
    startDate: Date | null;
    endDate: Date | null;
    antigens: CategoryOption[];
}

export default class Campaign {
    // Update OrganisationUnitStep.css accordingly if you change this value.
    public selectableLevels: number[] = [6];

    constructor(private db: DbD2, private data: Data) {
    }

    public static create(db: DbD2): Campaign {
        const initialData = {
            name: "",
            organisationUnits: [],
            startDate: null,
            endDate: null,
            antigens: [],
        };
        return new Campaign(db, initialData);
    }

    public validate() {
        const { organisationUnits, name, startDate, endDate, antigens } = this.data;

        const allOrgUnitsInAcceptedLevels = _(organisationUnits).every(ou =>
            _(this.selectableLevels).includes(_(ou.path).countBy().get("/") || 0));

        return _.pickBy({
            name: !name.trim() ? {
                key: "cannot_be_blank",
                namespace: {field: "name"}
            } : null,

            startDate: !startDate && endDate ? {
                key: "cannot_be_blank_if_other_set",
                namespace: {field: "startDate", other: "endDate"},
            } : null,

            organisationUnits: _.compact([
                !allOrgUnitsInAcceptedLevels ? {
                    key: "organisation_units_only_of_levels",
                    namespace: {levels: this.selectableLevels.join("/")},
                } : null,
                _(organisationUnits).isEmpty() ? {
                    key: "no_organisation_units_selected",
                } : null,
            ]),

            antigens: _(antigens).isEmpty() ? {
                key: "no_antigens_selected"
            } : null,
        });
    }

    /* Organisation units */

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

    /* Name */

    public setName(name: string): Campaign {
        return new Campaign(this.db, {...this.data, name});
    }

    public get name(): string {
        return this.data.name;
    }

    /* Period dates */

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

    /* Antigens */

    public setAntigens(antigens: CategoryOption[]): Campaign {
        return new Campaign(this.db, {...this.data, antigens});
    }

    public get antigens(): CategoryOption[] {
        return this.data.antigens;
    }

    public async getAvailableAntigens(): Promise<CategoryOption[]> {
        return this.db.getCategoryOptionsByCategoryCode(metadataConfig.categoryCodeForAntigens);
    }

    /* Save */

    public async save(): Promise<Response<string>> {
        const dashboardId = await this.db.createDashboard(this.name);
        const teamsCode = metadataConfig.categoryComboCodeForTeams;
        const antigenCodes = this.antigens.map(antigen => antigen.code);
        const vaccinationAttribute = await this.db.getAttributeIdByCode(metadataConfig.attibuteCodeForApp);
        const dashboardAttribute = await this.db.getAttributeIdByCode(metadataConfig.attributeCodeForDashboard);
        const categoryCombos = await this.db.getCategoryCombosByCode([teamsCode]);
        const categoryCombosByCode = _(categoryCombos).keyBy("code").value();
        const categoryComboTeams = _(categoryCombosByCode).get(teamsCode);
        const dataElementsGroups = await this.db.getDataElementGroupsByCodes(antigenCodes);

        const dataElementsByAntigenCode = _(dataElementsGroups)
            .keyBy("code")
            .mapValues("dataElements")
            .value();
        if (!vaccinationAttribute || !dashboardAttribute) {
            return { status: false, error: "Metadata not found: Attributes" }
        } else if (!categoryComboTeams) {
                return {status: false, error: `Metadata not found: teamsCode=${teamsCode}`};
        } else if (!dashboardId) {
            return { status: false, error: 'Error creating dashboard' };
        } else {
            const dataSetId = generateUid();
            const dataSetElements = _(this.antigens)
                    .flatMap(antigen => {
                        return _(dataElementsByAntigenCode).get(antigen.code).map(dataElement => {
                            return {
                                dataSet: {id: dataSetId},
                                dataElement: {id: dataElement.id},
                                categoryCombo: {id: dataElement.categoryCombo.id},
                            };
                        });
                    })
                    .value();

            const sections: Section[] = this.antigens.map(antigen => {
                return {
                    name: antigen.displayName,
                    showRowTotals: false,
                    showColumnTotals: false,
                    dataSet: {id: dataSetId},
                    dataElements: _(dataElementsByAntigenCode).get(antigen.code),
                    //greyedFields: [],
                }
            })
            const endDate = (!this.endDate && this.startDate) ? moment().endOf("year").toDate() : this.endDate;

            const dataInputPeriods = getDaysRange(this.startDate, endDate).map(date => ({
                openingDate: this.startDate ? this.startDate.toISOString() : undefined,
                closingDate: endDate ? endDate.toISOString() : undefined,
                period: {id: date.format("YYYYMMDD")}
            }));

            const dataSet: DataSet = {
                id: dataSetId,
                name: this.name,
                publicAccess: "r-r-----", // Metadata can view-only, Data can view-only
                periodType: "Daily",
                categoryCombo: {id: categoryComboTeams.id},
                dataElementDecoration: true,
                renderAsTabs: true,
                organisationUnits: this.organisationUnits.map(ou => ({id: ou.id})),
                dataSetElements,
                openFuturePeriods: 0,
                timelyDays: 0,
                expiryDays: 0,
                dataInputPeriods,
                attributeValues: [
                    { value: "true", attribute: { id: vaccinationAttribute.id } },
                    { value: dashboardId.id, attribute: { id: dashboardAttribute.id } },
                ],
            }

            const result: MetadataResponse =
                await this.db.postMetadata({
                    dataSets: [dataSet],
                    sections: sections,
                });

            return result.status === "OK"
                ? {status: true}
                : {status: false, error: JSON.stringify(result.typeReports, null, 2)};
        }
    }
}
