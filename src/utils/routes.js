export function goToDhis2Url(path) {
    const { REACT_APP_DHIS2_BASE_URL } = process.env;
    const clean = s => s.replace(/^\//, "");
    const url = [clean(REACT_APP_DHIS2_BASE_URL), clean(path)].join("/");
    window.location = url;
    return null;
}
