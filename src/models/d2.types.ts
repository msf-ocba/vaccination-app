import { Dictionary } from "lodash";
import { Ref } from "./db.types";

export interface D2 {
    Api: {
        getApi(): D2Api;
    };
}

export interface Params {
    paging?: boolean;
    pageSize?: number;
    filter?: string[];
    fields?: string[];
    order?: string;
}

export interface MetadataParams {
    [key: string]: string;
}

export interface D2Api {
    get(url: string, data: Params | MetadataParams): Dictionary<any>;
    post(url: string, data: Dictionary<any>): Dictionary<any>;
}
