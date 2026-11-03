// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

type PostUtils = {
    formatText: (text: string, options?: object) => string;
    messageHtmlToComponent: (html: string, options?: object) => React.ReactNode;
};

function hostPostUtils(): PostUtils | null {
    const utils = (window as unknown as {PostUtils?: PostUtils}).PostUtils;
    if (!utils || typeof utils.formatText !== 'function' || typeof utils.messageHtmlToComponent !== 'function') {
        return null;
    }
    return utils;
}

// RHSMarkdown renders markdown with the host's own message renderer, so Jira
// text gets the same sanitizing and styling as chat messages. Without the
// host (tests, very old servers) it falls back to plain text.
export default function RHSMarkdown(props: {text: string; className?: string}): JSX.Element | null {
    const rendered = useMemo(() => {
        const utils = hostPostUtils();
        if (!utils || !props.text) {
            return null;
        }
        const html = utils.formatText(props.text, {
            atMentions: false,
            mentionHighlight: false,
            markdown: true,
            singleline: false,
        });
        return utils.messageHtmlToComponent(html, {mentions: false, emoji: true, images: false});
    }, [props.text]);

    if (!props.text) {
        return null;
    }
    const className = 'jira-rhs-markdown' + (props.className ? ' ' + props.className : '');
    if (rendered === null) {
        return <div className={className + ' jira-rhs-markdown--plain'}>{props.text}</div>;
    }
    return <div className={className}>{rendered}</div>;
}
