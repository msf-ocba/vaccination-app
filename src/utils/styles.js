import { createMuiTheme } from "@material-ui/core";
import { muiTheme } from "../themes/dhis2.theme";

export function createMuiThemeOverrides(overrides) {
    return createMuiTheme({
        typography: {
            useNextVariants: true,
        },
        ...muiTheme,
        overrides,
    });
}
