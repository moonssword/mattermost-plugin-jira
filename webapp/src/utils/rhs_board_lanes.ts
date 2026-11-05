// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHSIssue} from 'types/rhs';
import {RHSBoard, RHSBoardProgress} from 'types/rhs_board';
import {RHSTransition} from 'types/rhs_issue';

import {plural, tr} from './i18n';

// A column of the board view. Without a chosen board the columns are the
// three status categories.
export type RHSLane = {
    id: string;
    name: string;
    statusIds: string[];
    categoryKey?: string;
    issues: RHSIssue[];
};

const CATEGORY_LANES: {key: string; name: string}[] = [
    {key: 'new', name: 'К выполнению'},
    {key: 'indeterminate', name: 'В работе'},
    {key: 'done', name: 'Готово'},
];

export const RHS_OUTSIDE_LANE_ID = 'outside';

// buildRHSLanes places issues in board columns by status id, or by status
// category when there is no board. Issues whose status is not on the board go
// to a trailing "outside" lane, shown only when it has issues.
export function buildRHSLanes(issues: RHSIssue[], board: RHSBoard | null, outsideName: string): RHSLane[] {
    if (!board || board.columns.length === 0) {
        return CATEGORY_LANES.map((c) => ({
            id: 'category:' + c.key,
            name: tr(c.name),
            statusIds: [],
            categoryKey: c.key,
            issues: issues.filter((issue) => (issue.status?.categoryKey === c.key) || (c.key === 'new' && !['indeterminate', 'done'].includes(issue.status?.categoryKey))),
        }));
    }
    const lanes: RHSLane[] = board.columns.map((column, index) => ({
        id: 'column:' + index,
        name: column.name,
        statusIds: column.statusIds,
        issues: [],
    }));
    const outside: RHSIssue[] = [];
    for (const issue of issues) {
        const lane = lanes.find((l) => issue.status?.id && l.statusIds.includes(issue.status.id));
        if (lane) {
            lane.issues.push(issue);
        } else {
            outside.push(issue);
        }
    }
    if (outside.length) {
        lanes.push({id: RHS_OUTSIDE_LANE_ID, name: outsideName, statusIds: [], issues: outside});
    }
    return lanes;
}

// defaultRHSLane opens the first lane with work in progress, else the first
// non-empty one.
export function defaultRHSLane(lanes: RHSLane[]): string {
    const busy = lanes.filter((l) => l.issues.length > 0 && l.id !== RHS_OUTSIDE_LANE_ID);
    const inProgress = busy.find((l) => l.categoryKey === 'indeterminate' || l.issues.some((i) => i.status?.categoryKey === 'indeterminate'));
    return (inProgress || busy[0] || lanes[0])?.id || '';
}

// nextRHSLane is the column to the right; the last column and the
// "outside" lane have none.
export function nextRHSLane(lanes: RHSLane[], laneId: string): RHSLane | null {
    const index = lanes.findIndex((l) => l.id === laneId);
    if (index < 0 || laneId === RHS_OUTSIDE_LANE_ID) {
        return null;
    }
    const next = lanes[index + 1];
    return next && next.id !== RHS_OUTSIDE_LANE_ID ? next : null;
}

// pickRHSTransition finds a transition that lands the issue in the lane.
export function pickRHSTransition(transitions: RHSTransition[], lane: RHSLane): RHSTransition | null {
    const found = transitions.find((t) => {
        if (lane.statusIds.length) {
            return Boolean(t.to.id) && lane.statusIds.includes(t.to.id as string);
        }
        return t.to.categoryKey === lane.categoryKey;
    });
    return found || null;
}

export function formatRHSPoints(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

// rhsDaysLeft counts calendar days from now to the end date; 0 is the last day.
export function rhsDaysLeft(endDate: string | undefined, nowMs: number): number | null {
    if (!endDate) {
        return null;
    }
    const end = Date.parse(endDate);
    if (Number.isNaN(end)) {
        return null;
    }
    const startOfDay = (ms: number) => {
        const d = new Date(ms);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    };
    return Math.round((startOfDay(end) - startOfDay(nowMs)) / 86400000);
}

export function rhsProgressTotal(p: RHSBoardProgress): number {
    return p.todo + p.inProgress + p.done;
}

// rhsProgressSummary is the one-line figure: "18/52 SP" or "5/12 задач".
export function rhsProgressSummary(p: RHSBoardProgress, pointsLabel: string): string {
    const total = rhsProgressTotal(p);
    if (p.unit === 'points') {
        return formatRHSPoints(p.done) + '/' + formatRHSPoints(total) + ' ' + pointsLabel;
    }
    return p.done + '/' + total + ' ' + plural(total, ['задача', 'задачи', 'задач'], ['issue', 'issues']);
}
