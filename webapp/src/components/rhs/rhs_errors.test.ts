// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {rhsReadableError} from './rhs_errors';
import {RHS_STRINGS} from './rhs_strings';

describe('rhsReadableError', () => {
    test('Jira not answering reads as such, Jira complaints pass', () => {
        expect(rhsReadableError({message: 'failed to GetProjectMetadata: No response returned: Get "http://jira/rest/api/2/project": EOF'}, 'x')).toBe(RHS_STRINGS.jiraUnreachable);
        expect(rhsReadableError({message: 'dial tcp 10.0.0.1:443: connect: connection refused'}, 'x')).toBe(RHS_STRINGS.jiraUnreachable);
        expect(rhsReadableError({message: 'summary: Field is required.'}, 'x')).toBe('summary: Field is required.');
        expect(rhsReadableError(null, 'fallback')).toBe('fallback');
        expect(rhsReadableError({message: ' '}, 'fallback')).toBe('fallback');
    });
});
