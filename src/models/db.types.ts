import { string, number } from "prop-types";

type Maybe<T> = T | undefined;

export interface Db {
    getOrganisationUnitsFromIds(ids: string[]):
        Promise<PaginatedObjects<OrganisationUnit>>;
}

export interface Pager {
    page: number;
    pageCount: number;
    total: number;
    pageSize: number;
}

export interface PaginatedObjects<T> {
    pager: Pager,
    objects: T[];
}

export interface OrganisationUnitPathOnly {
    id: string;
    path: string;
};


export interface OrganisationUnit {
    id: string;
    displayName: string;
    level: number;
    path: string;
    ancestors: Maybe<OrganisationUnit[]>;
};
