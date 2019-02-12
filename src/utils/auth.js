import _ from "lodash";

export function currentUserHasAdminRole(d2) {
    const authorities = d2.currentUser.authorities;
    return authorities.has("M_dhis-web-maintenance-appmanager") || authorities.has("ALL");
}

const requiredAuthorities = ["F_SECTION_DELETE", "F_SECTION_ADD"];

function hasRequiredAuthorities(d2) {
    return requiredAuthorities.every(authority => d2.currentUser.authorities.has(authority));
}

export function canManage(d2, model, objs) {
    return objs.every(obj => obj.access && obj.access.manage);
}

export function canCreate(d2, model, type) {
    const method = type === "private" ? "canCreatePrivate" : "canCreatePublic";
    return d2.currentUser[method](model) && hasRequiredAuthorities(d2);
}

export function canDelete(d2, model, objs) {
    if (objs.length === 0) return true;
    return (
        d2.currentUser.canDelete(model) &&
        _(objs).every(obj => obj.access && obj.access.delete) &&
        hasRequiredAuthorities(d2)
    );
}

export function canUpdate(d2, model, objs) {
    if (objs.length === 0) return true;
    const anyPublic = _(objs).some(obj => obj.publicAccess.match(/^r/));
    const anyPrivate = _(objs).some(obj => obj.publicAccess.match(/^-/));
    const allUpdatable = _(objs).every(obj => obj.access.update);
    const privateCondition = !anyPrivate || d2.currentUser.canCreatePrivate(model);
    const publicCondition = !anyPublic || d2.currentUser.canCreatePublic(model);
    return hasRequiredAuthorities(d2) && privateCondition && publicCondition && allUpdatable;
}
