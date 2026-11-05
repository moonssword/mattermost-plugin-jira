// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {plural} from 'utils/i18n';

import {RHSErrorCode} from 'types/rhs';
import {RHSBoard, RHSBoardProgress} from 'types/rhs_board';
import {
    formatRHSPoints,
    rhsDaysLeft,
    rhsProgressSummary,
    rhsProgressTotal,
} from 'utils/rhs_board_lanes';
import {formatRHSShortDate} from 'utils/rhs_time';

import {RHSSkeletonSprint} from '../../rhs_skeleton';
import {RHS_STRINGS} from '../../rhs_strings';

export type Props = {
    boardName: string;
    board: RHSBoard | null;
    loading: boolean;
    error: RHSErrorCode | null;
    expanded: boolean;

    // The board view always shows the legend; the toggle is hidden there.
    canToggle: boolean;
    nowMs: number;
    onToggle: () => void;
    onRetry: () => void;
};

function daysShort(days: number | null): string {
    if (days === null) {
        return '';
    }
    if (days < 0) {
        return RHS_STRINGS.sprintOverdue;
    }
    return RHS_STRINGS.sprintDaysShort.replace('{n}', String(days));
}

function daysLong(endDate: string | undefined, nowMs: number): string {
    const days = rhsDaysLeft(endDate, nowMs);
    if (days === null || !endDate) {
        return '';
    }
    const ends = RHS_STRINGS.sprintEnds.replace('{date}', formatRHSShortDate(Date.parse(endDate), nowMs));
    if (days < 0) {
        return ends + ' · ' + RHS_STRINGS.sprintOverdue;
    }
    if (days === 0) {
        return ends + ' · ' + RHS_STRINGS.sprintLastDay;
    }
    return ends + ' · ' + RHS_STRINGS.sprintDaysLeft.replace('{n}', days + ' ' + plural(days, ['день', 'дня', 'дней'], ['day', 'days']));
}

function amount(n: number, p: RHSBoardProgress): string {
    return p.unit === 'points' ? formatRHSPoints(n) + ' ' + RHS_STRINGS.progressPoints : String(n);
}

export function progressBreakdown(p: RHSBoardProgress, kanban: boolean): Array<{key: string; text: string}> {
    return [
        {key: 'todo', text: amount(p.todo, p) + ' ' + RHS_STRINGS.progressTodo},
        {key: 'progress', text: amount(p.inProgress, p) + ' ' + RHS_STRINGS.progressInProgress},
        {key: 'done', text: amount(p.done, p) + ' ' + (kanban ? RHS_STRINGS.progressDoneRecent : RHS_STRINGS.progressDone)},
    ];
}

function ProgressBar(props: {progress: RHSBoardProgress}): JSX.Element {
    const p = props.progress;
    const total = rhsProgressTotal(p);
    return (
        <div
            className='jira-rhs-pbar'
            aria-hidden={true}
        >
            {total > 0 && (
                <>
                    <span
                        className='jira-rhs-pbar-todo'
                        style={{flexGrow: p.todo}}
                    />
                    <span
                        className='jira-rhs-pbar-progress'
                        style={{flexGrow: p.inProgress}}
                    />
                    <span
                        className='jira-rhs-pbar-done'
                        style={{flexGrow: p.done}}
                    />
                </>
            )}
        </div>
    );
}

// SprintStrip shows the progress of the chosen board: the active sprint of a
// Scrum board, or the open work of a Kanban board. One line in the list, with
// a legend when expanded.
export default function SprintStrip(props: Props): JSX.Element {
    const {board, nowMs} = props;
    const kanban = board?.type === 'kanban';
    const sprint = board?.sprint;
    const title = (kanban ? board?.name : sprint?.name) || board?.name || props.boardName;
    const progress = board?.progress;

    if (props.error && !board) {
        return (
            <div
                className='jira-rhs-sstrip jira-rhs-sstrip--error'
                data-testid='rhs-sprint-strip'
            >
                <b>{props.boardName}</b>
                <span className='jira-rhs-sstrip-note'>{RHS_STRINGS.boardLoadFailed}</span>
                <button
                    type='button'
                    className='jira-rhs-link-button'
                    onClick={props.onRetry}
                >
                    {RHS_STRINGS.retry}
                </button>
            </div>
        );
    }

    const toggle = props.canToggle && progress ? (
        <button
            type='button'
            className='jira-rhs-icon-button jira-rhs-sstrip-toggle'
            aria-expanded={props.expanded}
            aria-label={RHS_STRINGS.sprintDetails}
            title={RHS_STRINGS.sprintDetails}
            data-testid='rhs-sprint-toggle'
            onClick={props.onToggle}
        >
            <i
                className={props.expanded ? 'icon icon-chevron-up' : 'icon icon-chevron-down'}
                aria-hidden={true}
            />
        </button>
    ) : null;

    if (!progress) {
        return (
            <div
                className='jira-rhs-sstrip'
                data-testid='rhs-sprint-strip'
            >
                <b>{title}</b>
                {props.loading || !board ? <RHSSkeletonSprint/> : (
                    <span className='jira-rhs-sstrip-note'>{RHS_STRINGS.boardNoSprint}</span>
                )}
            </div>
        );
    }

    const breakdown = progressBreakdown(progress, kanban);
    const days = kanban ? null : rhsDaysLeft(sprint?.endDate, nowMs);
    const summary = rhsProgressSummary(progress, RHS_STRINGS.progressPoints) + (days === null ? '' : ' · ' + daysShort(days));
    const tooltip = breakdown.map((b) => b.text).join(', ') + (progress.truncated ? '. ' + RHS_STRINGS.progressTruncated : '');

    if (!props.expanded) {
        return (
            <div
                className='jira-rhs-sstrip'
                title={tooltip}
                data-testid='rhs-sprint-strip'
            >
                <b>{title}</b>
                <ProgressBar progress={progress}/>
                <span
                    className='jira-rhs-sstrip-n'
                    data-testid='rhs-sprint-summary'
                >
                    {summary}
                </span>
                {toggle}
            </div>
        );
    }

    const sub = kanban ? RHS_STRINGS.boardTypeKanban : daysLong(sprint?.endDate, nowMs);
    return (
        <div
            className='jira-rhs-sprint'
            title={progress.truncated ? RHS_STRINGS.progressTruncated : ''}
            data-testid='rhs-sprint-strip'
        >
            <div className='jira-rhs-sprint-head'>
                <b>{title}</b>
                <span className='jira-rhs-sstrip-note'>{sub}</span>
                {board?.browseUrl && (
                    <a
                        className='jira-rhs-icon-button'
                        href={board.browseUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        aria-label={RHS_STRINGS.boardOpenInJira}
                        title={RHS_STRINGS.boardOpenInJira}
                    >
                        <i
                            className='icon icon-open-in-new'
                            aria-hidden={true}
                        />
                    </a>
                )}
                {toggle}
            </div>
            <ProgressBar progress={progress}/>
            <div
                className='jira-rhs-legend'
                data-testid='rhs-sprint-legend'
            >
                {breakdown.map((b) => (
                    <span key={b.key}>
                        <i className={'jira-rhs-legend-' + b.key}/>
                        {b.text}
                    </span>
                ))}
            </div>
        </div>
    );
}
