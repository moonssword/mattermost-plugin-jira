// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type RHSErrorCode =
    'not_connected' |
    'rate_limited' |
    'not_authorized' |
    'unsupported_instance' |
    'invalid_request' |
    'invalid_query' |
    'not_found' |
    'forbidden' |
    'jira_rejected' |
    'internal_error';

export type RHSSort = 'updated' | 'created';

export type RHSTab =
    | {kind: 'assigned'; name: string}
    | {kind: 'category'; key: string; name: string}
    | {kind: 'status'; id: string; name: string};

export type RHSIssueStatus = {

    // Places the issue in a board column; missing in older payloads.
    id?: string;
    name: string;
    categoryKey: string;
};

export type RHSIssue = {
    key: string;
    summary: string;
    browseUrl: string;
    status: RHSIssueStatus;
    issueType: string;
    issueTypeIconUrl?: string;
    project: string;
    updated: string;
    created?: string;
    dueDate?: string;
    priority?: string;
    priorityIconUrl?: string;

    // Display name of the assignee; avatars need the user's Jira session.
    assigneeName?: string;
    assigneeAvatarUrl?: string;

    // The selected board's estimation field (story points), when requested.
    estimate?: number;
};

// Quick filters of the "Мои задачи" section; the server builds their JQL.
export type RHSFilter = 'board' | 'assigned' | 'reported' | 'watching' | 'sprint';

export const RHS_FILTERS: RHSFilter[] = ['assigned', 'reported', 'watching', 'sprint'];

// With a board chosen the list stays inside it. "board" is what the board
// shows; a sprint filter has no sense there, as "board" is the sprint already.
export const RHS_BOARD_FILTERS: RHSFilter[] = ['board', 'assigned', 'reported', 'watching'];

export function rhsFilterForBoard(filter: RHSFilter, boardId: number): RHSFilter {
    if (boardId > 0) {
        return filter === 'sprint' ? 'board' : filter;
    }
    return filter === 'board' ? RHS_DEFAULT_FILTER : filter;
}

export const RHS_DEFAULT_FILTER: RHSFilter = 'assigned';

export function isRHSFilter(value: unknown): value is RHSFilter {
    return typeof value === 'string' && (RHS_BOARD_FILTERS.concat(RHS_FILTERS) as string[]).includes(value);
}

export type RHSIssuesResponse = {
    issues: RHSIssue[];
    nextPageToken: string;
    isLast: boolean;

    // Number of matching issues; only Jira Server/DC reports it.
    total?: number | null;
};

export type RHSStatusCategory = {
    id: number;
    key: string;
    name: string;
};

export type RHSStatusProject = {
    id?: string;
    key?: string;
    name?: string;
};

export type RHSStatus = {
    id: string;
    name: string;
    statusCategory: RHSStatusCategory;
    project?: RHSStatusProject;
};

export type RHSStatusesResponse = {
    statuses: RHSStatus[];
    categories: RHSStatusCategory[];
};

export type RHSViewState = {
    instance: string;
    filter: RHSFilter;
    sort: RHSSort;
};

export const RHS_DEFAULT_SORT: RHSSort = 'updated';

export const RHS_ASSIGNED_TAB_NAME = 'Assigned to me';

export const RHS_DEFAULT_TAB: RHSTab = {
    kind: 'assigned',
    name: RHS_ASSIGNED_TAB_NAME,
};

export type FetchRHSIssuesArgs = {
    instanceID: string;
    filter: RHSFilter;

    // Search box text: an issue key, plain text or JQL. Overrides the filter.
    query: string;
    sort: RHSSort;
};

export type GetRHSIssuesParams = FetchRHSIssuesArgs & {
    nextPageToken?: string;

    // Story points field of the selected board; the server adds it to rows.
    estimateField?: string;

    // The list stays inside this board.
    boardId?: number;

    // One column of the board view, as /rhs/lanes names it.
    lane?: string;
};

export function rhsTabIdentity(tab: RHSTab): string {
    switch (tab.kind) {
    case 'assigned':
        return 'assigned';
    case 'category':
        return 'category:' + tab.key;
    case 'status':
        return 'status:' + tab.id;
    default: {
        const exhaustive: never = tab;
        return exhaustive;
    }
    }
}

export function rhsTabFromAPI(raw: {kind?: unknown; name?: unknown; key?: unknown; id?: unknown}): RHSTab | null {
    const name = typeof raw.name === 'string' && raw.name ? raw.name : '';
    switch (raw.kind) {
    case 'assigned':
        return {
            kind: 'assigned',
            name: RHS_ASSIGNED_TAB_NAME,
        };
    case 'category': {
        if (typeof raw.key !== 'string' || !raw.key) {
            return null;
        }
        return {
            kind: 'category',
            key: raw.key,
            name: name || raw.key,
        };
    }
    case 'status': {
        if (typeof raw.id !== 'string' || !raw.id) {
            return null;
        }
        return {
            kind: 'status',
            id: raw.id,
            name: name || raw.id,
        };
    }
    default:
        return null;
    }
}
