export function goToDhis2Url(path) {
    const baseUrl = process.env.REACT_APP_DHIS2_BASE_URL || "";
    const url = [baseUrl.replace(/\/$/, ""), path.replace(/^\//, "")].join("/");
    window.location = url;
    return null;
}
