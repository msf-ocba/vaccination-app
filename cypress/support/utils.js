import { externalUrl } from "./network-fixtures";

export function getApiUrl(path) {
    const parts = [externalUrl, "api", path];
    return parts.map(part => part.replace(/\/+$/, "").replace(/^\/+/, "")).join("/");
}
