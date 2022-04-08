import _ from "lodash";
import axios from "axios";

export interface TableList<T> {
    objects: T[];
    pager: {
        total: number;
        page: number;
        pageCount: number;
    };
}

export type Order = "asc" | "desc";
export type StoreType = "global" | "user";

export interface TablePagination<T> {
    page: number;
    pageSize: number;
    sorting: Array<[keyof T, Order]>;
}

export class DataStore {
    storeUrl: string;

    constructor(public apiUrl: string, storeType: StoreType, public namespace: string) {
        const storePath = storeType === "global" ? "dataStore" : "userDataStore";
        this.storeUrl = apiUrl + "/" + storePath;
    }

    private getPath(key: string): string {
        return [this.storeUrl, this.namespace, key].join("/");
    }

    async get<T extends object>(key: string): Promise<T | undefined> {
        try {
            const response = await axios.get(this.getPath(key), { withCredentials: true });
            return response.data;
        } catch (err0) {
            const error = err0 as any;
            if (error.response && error.response.status === 404) {
                return undefined;
            } else {
                throw error;
            }
        }
    }

    async getOrSet<T extends object>(key: string, defaultValue: T): Promise<T> {
        try {
            const response = await axios.get(this.getPath(key), { withCredentials: true });
            return response.data;
        } catch (err0) {
            const error = err0 as any;
            if (error.response && error.response.status === 404) {
                await axios.post(this.getPath(key), defaultValue, { withCredentials: true });
                return defaultValue;
            } else {
                throw error;
            }
        }
    }

    async getPaginated<T>(
        key: string,
        pagination: TablePagination<T>,
        options: { filter?: (object: T) => boolean }
    ): Promise<TableList<T>> {
        const { sorting, page = 1, pageSize = 20 } = pagination;
        const { filter: filterFn } = options;

        const objects = (await this.get<T[]>(key)) || [];
        const filteredObjects = filterFn ? objects.filter(filterFn) : objects;
        const [fields, orders] = _.unzip(sorting);
        const sortedObjects = _.orderBy(filteredObjects, fields as string[], orders as string[]);

        const currentlyShown = (page - 1) * pageSize;
        const pageCount = Math.ceil(sortedObjects.length / pageSize);
        const total = sortedObjects.length;
        const paginatedData = _.slice(sortedObjects, currentlyShown, currentlyShown + pageSize);

        return { objects: paginatedData, pager: { page, pageCount, total } };
    }

    async set(key: string, value: any): Promise<void> {
        try {
            await axios.put(this.getPath(key), value, { withCredentials: true });
        } catch (err0) {
            const error = err0 as any;
            if (error.response && error.response.status === 404) {
                await axios.post(this.getPath(key), value, { withCredentials: true });
            } else {
                throw error;
            }
        }
    }

    async delete(key: string): Promise<void> {
        try {
            await axios.delete(this.getPath(key), { withCredentials: true });
        } catch (err0) {
            const error = err0 as any;
            if (!error.response || error.response.status !== 404) {
                throw error;
            }
        }
    }
}
