// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHS_STRINGS} from './rhs_strings';

// The plugin passes Jira's own complaints on, and they help: a required
// field, a wrong value. When Jira did not answer at all the message is the
// server's request ("Get http://...: EOF"), which tells the user nothing.
const UNREACHABLE = /No response returned|: EOF\b|dial tcp|connection refused|i\/o timeout|context deadline exceeded|Bad Gateway|Service Unavailable|<html/i;

// rhsReadableError gives the text to show for a failed request.
export function rhsReadableError(error: unknown, fallback: string): string {
    const message = error && typeof error === 'object' && 'message' in error ? (error as {message: unknown}).message : '';
    if (typeof message !== 'string' || !message.trim()) {
        return fallback;
    }
    return UNREACHABLE.test(message) ? RHS_STRINGS.jiraUnreachable : message;
}
