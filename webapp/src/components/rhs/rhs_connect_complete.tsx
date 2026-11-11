// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import manifest from '../../manifest';

import {RHS_STRINGS} from './rhs_strings';

// The page a browser lands on after signing in to Mattermost on its way back
// from Jira (/plug/jira/connect-complete?next=...). Mattermost returns there
// inside its own app, not to the plugin's address, so this page opens the
// plugin's OAuth callback, now with a session.

// rhsConnectNext accepts only the plugin's own OAuth callback, so the page
// cannot send anyone elsewhere.
export function rhsConnectNext(next: string | null): string {
    if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\') || next.includes('..')) {
        return '';
    }
    const path = next.split('?')[0];
    const prefix = '/plugins/' + manifest.id + '/instance/';
    if (!path.startsWith(prefix) || !path.endsWith('/oauth1/complete.html')) {
        return '';
    }
    return next;
}

export default function RHSConnectComplete(): JSX.Element {
    const [invalid, setInvalid] = useState(false);

    useEffect(() => {
        const next = rhsConnectNext(new URLSearchParams(window.location.search).get('next'));
        if (!next) {
            setInvalid(true);
            return;
        }
        const basename = ((window as unknown as {basename?: string}).basename || '').replace(/\/+$/, '');
        window.location.replace(basename + next);
    }, []);

    return (
        <div
            className='jira-rhs-connect-complete'
            data-testid='rhs-connect-complete'
            style={{padding: '48px 24px', textAlign: 'center', color: 'var(--center-channel-color)'}}
        >
            {invalid ? RHS_STRINGS.connectCompleteInvalid : RHS_STRINGS.connectCompleteTitle}
        </div>
    );
}
