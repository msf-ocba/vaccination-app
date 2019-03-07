import _ from "lodash";

declare module "lodash" {
    interface LoDashStatic {
        getOrFail<TObject extends object, TKey extends keyof TObject>(
            object: TObject | null | undefined,
            path: TKey | [TKey]
        ): TObject[TKey];
    }

    interface LoDashImplicitWrapper<TValue> {
        getOrFail<TObject extends object, TKey extends keyof TObject>(
            this: LoDashImplicitWrapper<TObject | null | undefined>,
            path: TKey | [TKey]
        ): TObject[TKey];
    }
}

function getOrFail(obj: any, key: string): any {
    const value = _.get(obj, key);
    if (value === undefined) {
        throw new Error(`Key ${key} not found in object ${JSON.stringify(obj, null, 2)}`);
    } else {
        return value;
    }
}

_.mixin(
    {
        getOrFail,
    },
    { chain: false }
);
