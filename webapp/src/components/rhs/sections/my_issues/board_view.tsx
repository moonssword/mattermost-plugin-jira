// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';

import {RHSIssue} from 'types/rhs';
import {RHSBoard} from 'types/rhs_board';
import {RHSTransition} from 'types/rhs_issue';
import {
    RHSLane,
    buildRHSLanes,
    defaultRHSLane,
    formatRHSPoints,
    nextRHSLane,
    pickRHSTransition,
} from 'utils/rhs_board_lanes';

import {mergeRHSLanes, rhsLaneCount} from 'utils/rhs_board_lanes_lazy';

import RHSIssueTypeIcon from '../../rhs_issue_type_icon';
import RHSLoadMore from '../../rhs_load_more';
import {RHSPriorityIcon, RHSRowAvatar, rhsRowTitle} from '../../rhs_issue_row';
import {RHS_STRINGS} from '../../rhs_strings';
import {RHSSkeletonRows} from '../../rhs_skeleton';

import {LoadRHSLaneCounts, LoadRHSLanePage, useRHSLanes} from './use_rhs_lanes';

// Transitions load when the pointer rests on a card or it gets focus.
export const RHS_TRANSITIONS_DELAY_MS = 150;

type TransitionsEntry = RHSTransition[] | 'loading' | 'error';

export type Props = {
    issues: RHSIssue[];
    board: RHSBoard | null;
    nowMs: number;
    isLast: boolean;
    loading: boolean;
    onLoadMore: () => void;
    onOpenIssue: (key: string) => void;
    loadTransitions: (key: string) => Promise<{data?: RHSTransition[]; error?: unknown}>;
    moveIssue: (key: string, transitionID: string) => Promise<{data?: unknown; error?: unknown}>;

    // Columns load one at a time, with their counters first. Without these
    // the view places the loaded list in columns, as before.
    lanesEnabled?: boolean;
    lanesResetKey?: string;
    lanesRefreshKey?: string | number;
    loadLaneCounts?: LoadRHSLaneCounts;
    loadLanePage?: LoadRHSLanePage;

    // The column chosen before the view was rebuilt, for example by a new
    // sort, and whether the user chose it.
    initialLane?: string;
    initialLanePicked?: boolean;
    onLaneChange?: (lane: string, picked: boolean) => void;
};

const noCounts: LoadRHSLaneCounts = () => Promise.resolve({data: {supported: false, lanes: []}});
const noPage: LoadRHSLanePage = () => Promise.resolve({error: true});

function cacheKey(issue: RHSIssue): string {
    return issue.key + '@' + (issue.status?.id || issue.status?.name || '');
}

// BoardView is the "Доска" view of the same filter (design 4в): one column
// at a time, switched by chips with counts, and a button that moves the
// active card to the next column.
export default function BoardView(props: Props): JSX.Element {
    const listLanes = buildRHSLanes(props.issues, props.board, RHS_STRINGS.boardOutside);
    const [laneId, setLaneId] = useState(() => {
        if (props.initialLane && listLanes.some((l) => l.id === props.initialLane)) {
            return props.initialLane;
        }
        return defaultRHSLane(listLanes);
    });

    // Set once the user opens a column: the counters no longer choose it.
    const picked = useRef(Boolean(props.initialLanePicked && props.initialLane === laneId));
    const onLaneChange = props.onLaneChange;
    useEffect(() => {
        onLaneChange?.(laneId, picked.current);
    }, [laneId, onLaneChange]);
    const lazyWanted = Boolean(props.loadLaneCounts && props.loadLanePage);
    const lanesData = useRHSLanes({
        enabled: lazyWanted && props.lanesEnabled !== false,
        resetKey: props.lanesResetKey || '',
        refreshKey: props.lanesRefreshKey ?? '',
        activeLanes: [laneId],
        loadCounts: props.loadLaneCounts || noCounts,
        loadPage: props.loadLanePage || noPage,
    });
    const lazy = lazyWanted && props.lanesEnabled !== false && lanesData.supported !== false;
    const lanes = lazy ? mergeRHSLanes(listLanes, lanesData.counts, lanesData.pages, RHS_STRINGS.boardOutside, lanesData.categories) : listLanes;

    // The counters may point to a busier column than the first page did.
    useEffect(() => {
        if (!picked.current && lanesData.counts.size > 0) {
            const best = defaultRHSLane(lanes);
            if (best && best !== laneId) {
                setLaneId(best);
            }
        }

    // Only new counters choose again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lanesData.counts]);
    const [activeKey, setActiveKey] = useState('');
    const [transitions, setTransitions] = useState<Map<string, TransitionsEntry>>(() => new Map());
    const [moving, setMoving] = useState('');
    const [failedKey, setFailedKey] = useState('');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Keep a valid lane when the board or the filter changes.
    const lane: RHSLane | undefined = lanes.find((l) => l.id === laneId) || lanes.find((l) => l.id === defaultRHSLane(lanes));
    useEffect(() => {
        if (lane && lane.id !== laneId) {
            setLaneId(lane.id);
        }
    }, [lane, laneId]);

    useEffect(() => () => {
        if (timer.current) {
            clearTimeout(timer.current);
        }
    }, []);

    const lanePage = lane && lazy ? lanesData.pages.get(lane.id) || null : null;
    const next = lane ? nextRHSLane(lanes, lane.id) : null;

    const activate = (issue: RHSIssue) => {
        setActiveKey(issue.key);
        if (!next) {
            return;
        }
        const key = cacheKey(issue);
        if (transitions.has(key)) {
            return;
        }
        if (timer.current) {
            clearTimeout(timer.current);
        }
        timer.current = setTimeout(async () => {
            setTransitions((m) => new Map(m).set(key, 'loading'));
            const {data, error} = await props.loadTransitions(issue.key);
            setTransitions((m) => new Map(m).set(key, error || !data ? 'error' : data));
        }, RHS_TRANSITIONS_DELAY_MS);
    };

    const move = async (issue: RHSIssue, transition: RHSTransition) => {
        setMoving(issue.key);
        setFailedKey('');
        const {error} = await props.moveIssue(issue.key, transition.id);
        setMoving('');
        if (error) {
            setFailedKey(issue.key);
        }
    };

    return (
        <div
            className='jira-rhs-board'
            data-testid='rhs-board-view'
        >
            <div
                className='jira-rhs-lanes'
                role='tablist'
                aria-label={RHS_STRINGS.viewBoard}
            >
                {lanes.map((l) => (
                    <button
                        key={l.id}
                        type='button'
                        role='tab'
                        aria-selected={l.id === lane?.id}
                        className={'jira-rhs-lane' + (l.id === lane?.id ? ' jira-rhs-lane--on' : '')}
                        data-testid={'rhs-lane-' + l.id}
                        onClick={() => {
                            picked.current = true;
                            setLaneId(l.id);
                            onLaneChange?.(l.id, true);
                        }}
                    >
                        {l.name}
                        {rhsLaneCount(l) > 0 && <span className='jira-rhs-lane-count'>{rhsLaneCount(l)}</span>}
                    </button>
                ))}
            </div>
            <div
                className='jira-rhs-lanebg'
                role='tabpanel'
            >
                {lane && lane.issues.length === 0 && lazy && lanePage?.loading && (
                    <div
                        role='status'
                        aria-label={RHS_STRINGS.loading}
                    >
                        <RHSSkeletonRows count={3}/>
                    </div>
                )}
                {lane && lane.issues.length === 0 && !(lazy && (lanePage?.loading || lanePage?.error)) && (
                    <p className='jira-rhs-muted jira-rhs-lane-empty'>{RHS_STRINGS.boardEmptyLane}</p>
                )}
                {lane?.issues.map((issue) => {
                    const entry = transitions.get(cacheKey(issue));
                    const transition = next && Array.isArray(entry) ? pickRHSTransition(entry, next) : null;
                    const active = issue.key === activeKey;
                    return (
                        <div
                            key={issue.key}
                            className={'jira-rhs-bcard' + (active ? ' jira-rhs-bcard--active' : '')}
                            data-testid={'rhs-bcard-' + issue.key}
                            data-category={issue.status.categoryKey}
                            onMouseEnter={() => activate(issue)}
                            onFocus={() => activate(issue)}
                        >
                            <button
                                type='button'
                                className='jira-rhs-bcard-main'
                                title={rhsRowTitle(issue, props.nowMs)}
                                onClick={() => props.onOpenIssue(issue.key)}
                            >
                                <span className={'jira-rhs-bcard-summary' + (transition && active ? ' jira-rhs-bcard-summary--move' : '')}>{issue.summary}</span>
                                <span className='jira-rhs-bcard-foot'>
                                    <RHSIssueTypeIcon
                                        issueType={issue.issueType}
                                        iconUrl={issue.issueTypeIconUrl}
                                    />
                                    <RHSPriorityIcon issue={issue}/>
                                    <span className='jira-rhs-row-key'>{issue.key}</span>
                                    <span className='jira-rhs-bcard-end'>
                                        {typeof issue.estimate === 'number' && (
                                            <span
                                                className='jira-rhs-est'
                                                title={props.board?.estimateName || RHS_STRINGS.progressPoints}
                                            >
                                                {formatRHSPoints(issue.estimate)}
                                            </span>
                                        )}
                                        <RHSRowAvatar
                                            name={issue.assigneeName}
                                            url={issue.assigneeAvatarUrl}
                                        />
                                    </span>
                                </span>
                            </button>
                            {transition && next && active && (
                                <button
                                    type='button'
                                    className='jira-rhs-bcard-move'
                                    disabled={moving === issue.key}
                                    title={RHS_STRINGS.boardMove.replace('{column}', next.name)}
                                    data-testid={'rhs-move-' + issue.key}
                                    onClick={() => move(issue, transition)}
                                >
                                    {'→ ' + next.name}
                                </button>
                            )}
                            {failedKey === issue.key && (
                                <span
                                    className='jira-rhs-bcard-error'
                                    role='alert'
                                >
                                    {RHS_STRINGS.boardMoveFailed}
                                </span>
                            )}
                        </div>
                    );
                })}
                {lazy && lane && lanePage?.error && (
                    <div
                        className='jira-rhs-list-error'
                        data-testid='rhs-lane-error'
                    >
                        <span>{RHS_STRINGS.error}</span>
                        <button
                            type='button'
                            className='btn btn-secondary btn-sm'
                            onClick={() => lanesData.retry(lane.id)}
                        >
                            {RHS_STRINGS.retry}
                        </button>
                    </div>
                )}
                {lazy && lane && lanePage && !lanePage.error && !lanePage.isLast && lanePage.issues.length > 0 && (
                    <RHSLoadMore
                        loading={lanePage.loading}
                        onLoadMore={() => lanesData.loadMore(lane.id)}
                    />
                )}
                {!lazy && !props.isLast && (
                    <RHSLoadMore
                        loading={props.loading}
                        onLoadMore={props.onLoadMore}
                    />
                )}
            </div>
        </div>
    );
}
