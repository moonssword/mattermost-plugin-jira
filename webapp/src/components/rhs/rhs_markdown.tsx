// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

type PostUtils = {
    formatText: (text: string, options?: object) => string;
    messageHtmlToComponent: (html: string, options?: object) => React.ReactNode;
};

type Part = {kind: 'text'; text: string} | {kind: 'image'; alt: string; url: string};

// Pictures attached to the issue, as the server writes them. The panel shows
// them itself: the host's renderer expects post metadata that does not exist here.
const ATTACHMENT_IMAGE = /!\[([^\]\n]*)\]\(([^)\s]+\/rhs\/attachment\?[^)\s]+)\)/g;

export function splitRHSMarkdown(text: string): Part[] {
    const parts: Part[] = [];
    let last = 0;
    for (const match of text.matchAll(ATTACHMENT_IMAGE)) {
        const index = match.index ?? 0;
        if (index > last) {
            parts.push({kind: 'text', text: text.slice(last, index)});
        }
        parts.push({kind: 'image', alt: match[1], url: match[2]});
        last = index + match[0].length;
    }
    if (last < text.length) {
        parts.push({kind: 'text', text: text.slice(last)});
    }
    return parts;
}

function hostPostUtils(): PostUtils | null {
    const utils = (window as unknown as {PostUtils?: PostUtils}).PostUtils;
    if (!utils || typeof utils.formatText !== 'function' || typeof utils.messageHtmlToComponent !== 'function') {
        return null;
    }
    return utils;
}

function renderText(utils: PostUtils | null, text: string): React.ReactNode {
    if (!utils) {
        return <div className='jira-rhs-markdown--plain'>{text}</div>;
    }
    const html = utils.formatText(text, {
        atMentions: false,
        mentionHighlight: false,
        markdown: true,
        singleline: false,
    });
    return utils.messageHtmlToComponent(html, {mentions: false, emoji: true, images: false});
}

// RHSMarkdown renders markdown with the host's own message renderer, so Jira
// text gets the same sanitizing and styling as chat messages. Without the
// host (tests, very old servers) it falls back to plain text.
export default function RHSMarkdown(props: {text: string; className?: string}): JSX.Element | null {
    const rendered = useMemo(() => {
        if (!props.text) {
            return null;
        }
        const utils = hostPostUtils();
        return splitRHSMarkdown(props.text).map((part) => {
            if (part.kind === 'image') {
                return (
                    <a
                        key={part.url}
                        className='jira-rhs-md-image-link'
                        href={part.url}
                        target='_blank'
                        rel='noopener noreferrer'
                    >
                        <img
                            className='jira-rhs-md-image'
                            src={part.url}
                            alt={part.alt}
                            loading='lazy'
                        />
                    </a>
                );
            }
            return <React.Fragment key={part.text}>{renderText(utils, part.text)}</React.Fragment>;
        });
    }, [props.text]);

    if (!props.text) {
        return null;
    }
    const className = 'jira-rhs-markdown' + (props.className ? ' ' + props.className : '');
    return <div className={className}>{rendered}</div>;
}
