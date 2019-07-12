export function getCurrentUserRoles(d2) {
    const userRolesSymbol = Object.getOwnPropertySymbols(d2.currentUser).find(
        symbol => symbol.toString() === "Symbol(userRoles)"
    );

    if (!userRolesSymbol || !d2.currentUser[userRolesSymbol]) {
        console.error("Cannot get current user roles");
        return [];
    } else {
        return d2.currentUser[userRolesSymbol];
    }
}

export function isTestEnv() {
    return !!process.env.REACT_APP_CYPRESS;
}
