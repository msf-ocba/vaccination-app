import React from "react";
import { Icon, IconButton, Tooltip } from "@material-ui/core";
import { DialogButton } from "d2-ui-components";
import "./HelpButton.css";

import i18n from "../../locales";

export interface HelpProps {
    title: string;
    contents: string;
}

function Button({ onClick }: { onClick: () => void }) {
    return (
        <Tooltip title={i18n.t("Help")}>
            <IconButton onClick={onClick}>
                <Icon color="primary">help</Icon>
            </IconButton>
        </Tooltip>
    );
}

class HelpButton extends React.Component<HelpProps> {
    public render() {
        const { title, contents } = this.props;
        return <DialogButton buttonComponent={Button} title={title} contents={contents} />;
    }
}

export default HelpButton;
