import { Dictionary } from "lodash";

export interface D2 {
    Api: {
        getApi(): D2Api;
    };
}

export type DeleteResponse = {
    httpStatus: "OK" | "Conflict";
    httpStatusCode: number;
    status: "OK" | "ERROR";
    message?: string;
};

export interface D2Api {
    get(url: string, data: Dictionary<any>): Promise<Dictionary<any>>;
    post(url: string, data: Dictionary<any>): Promise<Dictionary<any>>;
    delete(url: string): Promise<DeleteResponse>;
}
