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
    userCredentials: {
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

export default class CampaignSharing {
    db: DbD2;

    sharings: { dashboard: SharingFilter[] } = {
        dashboard: [
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
    };

    constructor(private campaign: Campaign) {
        this.db = this.campaign.db;
    }

    public async forDashboard(): Promise<Sharing> {
        const userAccessesList = await promiseMap(this.sharings.dashboard, sharing => {
            switch (sharing.type) {
                case "userGroups":
                    return this.getUserGroupAccesses(sharing);
                case "usersByOrgUnits":
                    return this.getUserByOrgUnits(sharing);
                case "usersByOrgUnitsInGroupSet":
                    return this.getUserByOrgUnitsInGroupSet(sharing);
            }
        });

        return {
            publicAccess: getAccessValue({ metadata: "none" }),
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
        sharing: UserGroupsSharingFilter
    ): Promise<UserAndGroupAccesses> {
        const { userGroups } = await this.db.getMetadata<{ userGroups: UserGroup[] }>({
            userGroups: {
                fields: userGroupFields,
                filters: [`name:in:[${sharing.userGroups.join(",")}]`],
            },
        });

        if (userGroups.length !== sharing.userGroups.length)
            console.error("Missing user groups for sharing");

        const userGroupAccesses = _(userGroups)
            .map(userGroup => ({
                id: userGroup.id,
                displayName: userGroup.name,
                access: getAccessValue(sharing.permission),
            }))
            .value();

        return { userGroupAccesses };
    }

    private async getUserByOrgUnits(
        sharing: UsersByOrgUnitsSharingFilter
    ): Promise<UserAndGroupAccesses> {
        const orgUnitsIds = this.getOrgUnitIdsForLevel(sharing.level);

        const { users: usersWithCampaignOrgUnits } = await this.db.getMetadata<{ users: User[] }>({
            users: {
                fields: userFields,
                filters: [`dataViewOrganisationUnits.id:in:[${orgUnitsIds.join(",")}]`],
            },
        });

        const userAccesses = getUserAccessesFilteredByRoles(usersWithCampaignOrgUnits, sharing);

        return { userAccesses };
    }

    private async getUserByOrgUnitsInGroupSet(
        sharing: UsersByOrgUnitsInGroupSetSharingFilter
    ): Promise<UserAndGroupAccesses> {
        const orgUnitIds = this.getOrgUnitIdsForLevel(sharing.level);

        const { organisationUnitGroupSets } = await this.db.getMetadata<{
            organisationUnitGroupSets: OrganisationUnitGroupSet[];
        }>({
            organisationUnitGroupSets: {
                filters: [`name:eq:${sharing.organisationUnitGroupSetName}`],
            },
        });

        const ouGroupSet = _.first(organisationUnitGroupSets);
        const ouGroups = ouGroupSet ? ouGroupSet.organisationUnitGroups : [];

        if (!ouGroupSet)
            console.error(`Missing orgUnitGroupSet: ${sharing.organisationUnitGroupSetName}`);

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
        const userAccesses = getUserAccessesFilteredByRoles(usersInGroups, sharing);

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
        !_(user.userCredentials.userRoles)
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
