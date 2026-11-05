// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

// rhsInitials returns up to two initials: "Дмитрий Козлов" -> "ДК".
export function rhsInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
        return '?';
    }
    const letters = parts.length === 1 ? Array.from(parts[0]).slice(0, 2) : [Array.from(parts[0])[0], Array.from(parts[1])[0]];
    return letters.join('').toUpperCase();
}

// AvatarContent is an uploaded picture from the plugin server, or initials when
// the user has none or the picture does not load.
export function AvatarContent(props: {name: string; url?: string}): JSX.Element {
    const [failedUrl, setFailedUrl] = useState('');
    if (!props.url || props.url === failedUrl) {
        return <>{rhsInitials(props.name)}</>;
    }
    return (
        <img
            className='jira-rhs-avatar-img'
            src={props.url}
            alt=''
            onError={() => setFailedUrl(props.url || '')}
        />
    );
}

export default function RHSAvatar(props: {name: string; url?: string}): JSX.Element {
    return (
        <span
            className='jira-rhs-avatar'
            aria-hidden={true}
        >
            <AvatarContent
                name={props.name}
                url={props.url}
            />
        </span>
    );
}
