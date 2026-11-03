// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

// rhsInitials returns up to two initials: "Дмитрий Козлов" -> "ДК".
export function rhsInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
        return '?';
    }
    const letters = parts.length === 1 ? Array.from(parts[0]).slice(0, 2) : [Array.from(parts[0])[0], Array.from(parts[1])[0]];
    return letters.join('').toUpperCase();
}

// Initials instead of Jira avatars: avatar URLs are served by Jira and would
// need the user's Jira session in the browser.
export default function RHSAvatar(props: {name: string}): JSX.Element {
    return (
        <span
            className='jira-rhs-avatar'
            aria-hidden={true}
        >
            {rhsInitials(props.name)}
        </span>
    );
}
