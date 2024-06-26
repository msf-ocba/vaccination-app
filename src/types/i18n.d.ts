declare module "@dhis2/d2-i18n" {
    export function t(value: string, namespace?: object): string;
    export function changeLanguage(locale: string);
    export function setDefaultNamespace(namespace: string);
    export const store: { data: object };
}
