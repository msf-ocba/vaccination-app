import _ from "lodash";

import { OrganisationUnitGroupSet, Access, Sharing } from "./db.types";
import Campaign from "./campaign";
import DbD2 from "./db-d2";
import { promiseMap } from "../utils/promises";

/*
    Return sharing object {publicAccess, externalAccess, userAccesses, userGroupAccesses} for
    campaign objects.
*/

export interface UserAndGroupAccesses {
    userAccesses?: Access[];
    userGroupAccesses?: Access[];
}

type Permission = "none" | "view" | "edit";

interface ObjectPermission {
    metadata: Permission;
    data?: Permission;
}

interface UserGroupsSharingFilter {
    type: "userGroups";
    userGroups: string[];
    permission: ObjectPermission;
}

interface UsersByOrgUnitsSharingFilter {
    type: "usersByOrgUnits";
    level: number;
    userRoles: string[];
    permission: ObjectPermission;
}

interface UsersByOrgUnitsInGroupSetSharingFilter {
    type: "usersByOrgUnitsInGroupSet";
    level: number;
    organisationUnitGroupSetName: string;
    userRoles: string[];
    permission: ObjectPermission;
}

export type SharingFilter =
    | UserGroupsSharingFilter
    | UsersByOrgUnitsSharingFilter
    | UsersByOrgUnitsInGroupSetSharingFilter;

interface User {
    id: string;
    displayName: string;
    userCredentials?: {
        userRoles: Array<{
            id: string;
            name: string;
        }>;
    };
}

const userFields = {
    id: true,
    displayName: true,
    userCredentials: { userRoles: { id: true, name: true } },
};

interface UserGroup {
    id: string;
    name: string;
    users: User[];
}

const userGroupFields = {
    id: true,
    name: true,
    users: userFields,
};

const accessValues: { [Key in Permission]: string } = {
    none: "--",
    view: "r-",
    edit: "rw",
};

interface SharingDefinition {
    publicPermission: ObjectPermission;
    filters: SharingFilter[];
}

export default class CampaignSharing {
    db: DbD2;

    sharings: { dataSet: SharingDefinition; dashboard: SharingDefinition } = {
        dataSet: {
            publicPermission: { metadata: "edit", data: "view" },
            filters: [
                {
                    type: "userGroups",
                    userGroups: [
                        "_DATASET_Field Training",
                        "_DATASET_Field User",
                        "_DATASET_HMIS Officer",
                        "_DATASET_HQ Analyst",
                        "_DATASET_MedCo",
                        "_DATASET_Medical Focal Point",
                        "_DATASET_Online Data Entry",
                        "_DATASET_Super HMIS Officer",
                        "_DATASET_Superuser",
                        "_DATASET_TesaCo",
                        "_DATASET_Training user",
                    ],
                    permission: { metadata: "view", data: "edit" },
                },
            ],
        },
        dashboard: {
            publicPermission: { metadata: "none" },
            filters: [
                {
                    type: "userGroups",
                    userGroups: ["Vaccination Referents", "HMIS Officers"],
                    permission: { metadata: "edit" },
                },
                {
                    type: "usersByOrgUnits",
                    level: 4,
                    userRoles: ["Medical Focal Point", "Field User", "Online Data Entry"],
                    permission: { metadata: "edit" },
                },
                {
                    type: "usersByOrgUnits",
                    level: 3,
                    userRoles: ["MedCo"],
                    permission: { metadata: "edit" },
                },
                {
                    type: "usersByOrgUnitsInGroupSet",
                    level: 3,
                    organisationUnitGroupSetName: "8. Operational Cells",
                    userRoles: ["TesaCo"],
                    permission: { metadata: "edit" },
                },
            ],
        },
    };

    constructor(private campaign: Campaign) {
        this.db = this.campaign.db;
    }

    public async forDataSet(): Promise<Sharing> {
        return this.getSharing(this.sharings.dataSet);
    }

    public async forDashboard(): Promise<Sharing> {
        return this.getSharing(this.sharings.dashboard);
    }

    private async getSharing(sharingDefinition: SharingDefinition): Promise<Sharing> {
        const userAccessesList = await promiseMap(sharingDefinition.filters, filter => {
            switch (filter.type) {
                case "userGroups":
                    return this.getUserGroupAccesses(filter);
                case "usersByOrgUnits":
                    return this.getUsersByOrgUnitsAccesses(filter);
                case "usersByOrgUnitsInGroupSet":
                    return this.getUsersByOrgUnitsInGroupSetAccesses(filter);
            }
        });

        return {
            publicAccess: getAccessValue(sharingDefinition.publicPermission),
            externalAccess: false,
            userAccesses: getAccesses(userAccessesList, "userAccesses"),
            userGroupAccesses: getAccesses(userAccessesList, "userGroupAccesses"),
        };
    }

    private getOrgUnitIdsForLevel(level: number): string[] {
        return _(this.campaign.organisationUnits)
            .map(ou => ou.path.split("/")[level])
            .compact()
            .value();
    }

    private async getUserGroupAccesses(
        filter: UserGroupsSharingFilter
    ): Promise<UserAndGroupAccesses> {
        const { userGroups } = await this.db.getMetadata<{ userGroups: UserGroup[] }>({
            userGroups: {
                fields: userGroupFields,
                filters: [`name:in:[${filter.userGroups.join(",")}]`],
            },
        });

        if (userGroups.length !== filter.userGroups.length)
            console.error("Missing user groups for sharing");

        const userGroupAccesses = _(userGroups)
            .map(userGroup => ({
                id: userGroup.id,
                displayName: userGroup.name,
                access: getAccessValue(filter.permission),
            }))
            .value();

        return { userGroupAccesses };
    }

    private async getUsersByOrgUnitsAccesses(
        filter: UsersByOrgUnitsSharingFilter
    ): Promise<UserAndGroupAccesses> {
        const orgUnitsIds = this.getOrgUnitIdsForLevel(filter.level);

        const { users: usersWithCampaignOrgUnits } = await this.db.getMetadata<{ users: User[] }>({
            users: {
                fields: userFields,
                filters: [`dataViewOrganisationUnits.id:in:[${orgUnitsIds.join(",")}]`],
            },
        });

        const userAccesses = getUserAccessesFilteredByRoles(usersWithCampaignOrgUnits, filter);

        return { userAccesses };
    }

    private async getUsersByOrgUnitsInGroupSetAccesses(
        filter: UsersByOrgUnitsInGroupSetSharingFilter
    ): Promise<UserAndGroupAccesses> {
        const orgUnitIds = this.getOrgUnitIdsForLevel(filter.level);

        const { organisationUnitGroupSets } = await this.db.getMetadata<{
            organisationUnitGroupSets: OrganisationUnitGroupSet[];
        }>({
            organisationUnitGroupSets: {
                filters: [`name:eq:${filter.organisationUnitGroupSetName}`],
            },
        });

        const ouGroupSet = _.first(organisationUnitGroupSets);
        const ouGroups = ouGroupSet ? ouGroupSet.organisationUnitGroups : [];

        if (!ouGroupSet)
            console.error(`Missing orgUnitGroupSet: ${filter.organisationUnitGroupSetName}`);

        const orgUnitGroupsMatching = ouGroups.filter(
            ouGroup =>
                !_(ouGroup.organisationUnits)
                    .map(ou => ou.id)
                    .intersection(orgUnitIds)
                    .isEmpty()
        );

        const { userGroups } = await this.db.getMetadata<{ userGroups: UserGroup[] }>({
            userGroups: {
                fields: userGroupFields,
                filters: [`name:in:[${orgUnitGroupsMatching.map(oug => oug.name).join(",")}]`],
            },
        });

        const usersInGroups = _.flatMap(userGroups, userGroup => userGroup.users);
        const userAccesses = getUserAccessesFilteredByRoles(usersInGroups, filter);

        return { userAccesses };
    }
}

function getAccessValue(objectPermission: ObjectPermission): string {
    return [
        accessValues[objectPermission.metadata],
        accessValues[objectPermission.data || "none"],
        "----",
    ].join("");
}

function getAccesses<K extends keyof UserAndGroupAccesses>(
    userAccessesList: UserAndGroupAccesses[],
    key: K
): Access[] {
    return _(userAccessesList)
        .flatMap(userAccess => userAccess[key] as Access[])
        .compact()
        .uniqBy("id")
        .value();
}

function getUserAccessesFilteredByRoles(
    users: User[],
    sharing: { userRoles: string[]; permission: ObjectPermission }
) {
    const userMatchesSomeUserRole = (user: User) =>
        !_(user.userCredentials ? user.userCredentials.userRoles : [])
            .map(userRole => userRole.name)
            .intersection(sharing.userRoles)
            .isEmpty();

    const userAccesses = _(users)
        .filter(userMatchesSomeUserRole)
        .map(user => ({
            id: user.id,
            displayName: user.displayName,
            access: getAccessValue(sharing.permission),
        }))
        .value();

    return userAccesses;
}
