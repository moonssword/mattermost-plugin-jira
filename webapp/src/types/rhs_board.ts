// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHSErrorCode} from './rhs';

// How "Мои задачи" shows the list: compact rows or board columns.
export type RHSListView = 'list' | 'board';

export function isRHSListView(value: unknown): value is RHSListView {
    return value === 'list' || value === 'board';
}

// One entry of the board picker.
export type RHSBoardRef = {
    id: number;
    name: string;
    type: string;
    projectKey?: string;
    projectName?: string;
};

export type RHSBoardColumn = {
    name: string;
    statusIds: string[];
};

export type RHSSprint = {
    id: number;
    name: string;
    startDate?: string;
    endDate?: string;
};

// Sprint (or Kanban board) split by status category, in story points or issues.
export type RHSBoardProgress = {
    unit: 'points' | 'issues';
    todo: number;
    inProgress: number;
    done: number;
    truncated?: boolean;
};

export type RHSBoard = RHSBoardRef & {
    browseUrl: string;
    columns: RHSBoardColumn[];
    estimateField?: string;
    estimateName?: string;
    sprint?: RHSSprint;
    progress?: RHSBoardProgress;
};

// Per user and instance, kept in localStorage.
export type RHSBoardPrefs = {
    boardId: number;
    boardName: string;
    view: RHSListView;
};

export type RHSBoardState = RHSBoardPrefs & {
    instanceID: string;
    board: RHSBoard | null;
    loading: boolean;
    error: RHSErrorCode | null;
};

// Size of one column of the board view; null when Jira does not count.
export type RHSLaneCount = {
    id: string;
    count: number | null;
    categoryKey?: string;
};

// Without supported the board view places the loaded list in columns itself.
export type RHSLanesResponse = {
    supported: boolean;
    lanes: RHSLaneCount[];
};
