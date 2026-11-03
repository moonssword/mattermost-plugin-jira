// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Top-level sections of the Jira RHS. Add a new id here and register the
// section in components/rhs/rhs_sections.ts to get a new tab.
export type RHSSectionID = 'my_issues' | 'channel' | 'create';

export const RHS_DEFAULT_SECTION: RHSSectionID = 'my_issues';

export const RHS_SECTION_IDS: RHSSectionID[] = ['my_issues', 'channel', 'create'];

export function isRHSSectionID(value: unknown): value is RHSSectionID {
    return typeof value === 'string' && (RHS_SECTION_IDS as string[]).includes(value);
}

export type RHSNavState = {
    section: RHSSectionID;
};
