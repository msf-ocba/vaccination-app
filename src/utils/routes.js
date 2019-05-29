export function goToDhis2Url(d2, path) {
    const url = getDhis2Url(d2, path);
    window.location = url;
    return null;
}

export function getDhis2Url(d2, path) {
    const baseUrl = d2.system.systemInfo.contextPath;
    return [baseUrl.replace(/\/$/, ""), path.replace(/^\//, "")].join("/");
}
