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

import RHSIssueTypeIcon from '../../rhs_issue_type_icon';
import {RHSPriorityIcon, RHSRowAvatar, rhsRowTitle} from '../../rhs_issue_row';
import {RHS_STRINGS} from '../../rhs_strings';

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
};

function cacheKey(issue: RHSIssue): string {
    return issue.key + '@' + (issue.status?.id || issue.status?.name || '');
}

// BoardView is the "Доска" view of the same filter (design 4в): one column
// at a time, switched by chips with counts, and a button that moves the
// active card to the next column.
export default function BoardView(props: Props): JSX.Element {
    const lanes = buildRHSLanes(props.issues, props.board, RHS_STRINGS.boardOutside);
    const [laneId, setLaneId] = useState(() => defaultRHSLane(lanes));
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
                        onClick={() => setLaneId(l.id)}
                    >
                        {l.name}
                        {l.issues.length > 0 && <span className='jira-rhs-lane-count'>{l.issues.length}</span>}
                    </button>
                ))}
            </div>
            <div
                className='jira-rhs-lanebg'
                role='tabpanel'
            >
                {lane && lane.issues.length === 0 && (
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
                                        <RHSRowAvatar name={issue.assigneeName}/>
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
                {!props.isLast && !props.loading && (
                    <button
                        type='button'
                        className='jira-rhs-load-more'
                        data-testid='rhs-load-more'
                        onClick={props.onLoadMore}
                    >
                        {RHS_STRINGS.loadMore}
                    </button>
                )}
            </div>
        </div>
    );
}
