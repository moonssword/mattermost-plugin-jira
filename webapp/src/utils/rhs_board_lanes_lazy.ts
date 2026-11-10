// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHSIssue} from 'types/rhs';

import {RHSLane, RHS_OUTSIDE_LANE_ID} from './rhs_board_lanes';

export type RHSLoadedLane = {
    issues: RHSIssue[];
    loading?: boolean;
};

// mergeRHSLanes puts the counters and the loaded pages of the columns over
// the columns built from the first page of the list. A column not loaded yet
// shows the issues of that page meanwhile. The "outside" column shows up when
// the server finds issues for it.
export function mergeRHSLanes(
    lanes: RHSLane[],
    counts: Map<string, number | null>,
    pages: Map<string, RHSLoadedLane>,
    outsideName: string,
    categories: Map<string, string> = new Map(),
): RHSLane[] {
    const merged = lanes.map((lane) => {
        const page = pages.get(lane.id);
        return {
            ...lane,
            issues: page && (page.issues.length > 0 || !page.loading) ? page.issues : lane.issues,
            count: counts.has(lane.id) ? counts.get(lane.id) : lane.count,
            categoryKey: lane.categoryKey || categories.get(lane.id) || lane.categoryKey,
        };
    });
    const outside = counts.get(RHS_OUTSIDE_LANE_ID);
    if (!merged.some((lane) => lane.id === RHS_OUTSIDE_LANE_ID) && typeof outside === 'number' && outside > 0) {
        merged.push({
            id: RHS_OUTSIDE_LANE_ID,
            name: outsideName,
            statusIds: [],
            issues: pages.get(RHS_OUTSIDE_LANE_ID)?.issues || [],
            count: outside,
        });
    }

    // Counted empty: the issues of the first page that fell here are gone.
    return merged.filter((lane) => lane.id !== RHS_OUTSIDE_LANE_ID || lane.count !== 0);
}

// rhsLaneCount is the number shown on a column chip.
export function rhsLaneCount(lane: RHSLane): number {
    return typeof lane.count === 'number' ? lane.count : lane.issues.length;
}
