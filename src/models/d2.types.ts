import { Dictionary } from "lodash";

export interface D2 {
    Api: {
        getApi(): D2Api;
    };
}

export interface D2Api {
    get(url: string, data: Dictionary<any>): Dictionary<any>;
    post(url: string, data: Dictionary<any>): Dictionary<any>;
}
