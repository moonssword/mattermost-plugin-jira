// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';

import type {ResolveAndFetchArgs} from 'actions';

import {
    RHSErrorCode,
    RHSFilter,
    RHSIssue,
    RHSSort,
} from 'types/rhs';
import {RHSBoard, RHSBoardRef, RHSListView} from 'types/rhs_board';
import {RHSTransition} from 'types/rhs_issue';

import RHSIssueList from '../../rhs_issue_list';
import {RHSSkeletonList} from '../../rhs_skeleton';
import {
    RHSEmptyState,
    RHSErrorState,
    RHSQueryErrorState,
    RHSRateLimitedState,
} from '../../rhs_states';
import {RHS_STRINGS} from '../../rhs_strings';

import BoardPicker from './board_picker';
import BoardView from './board_view';
import FilterBar from './filter_bar';
import SearchBox from './search_box';
import SprintStrip from './sprint_strip';

// The shell sends this window event for the "/" shortcut.
export const RHS_SEARCH_EVENT = 'jira-rhs:focus-search';

export type Props = {
    instanceID: string;
    filter: RHSFilter;
    query: string;
    sort: RHSSort;
    issues: RHSIssue[];
    isLast: boolean;
    total: number | null;
    loading: boolean;
    error: RHSErrorCode | null;
    errorMessage: string;

    // Instance whose issues are in the store; differs right after a switch.
    loadedInstanceID: string;

    // Live updates arrived while the panel was closed.
    stale: boolean;

    // Chosen board and view (design 4в).
    boardId: number;
    boardName: string;
    board: RHSBoard | null;
    boardLoading: boolean;
    boardError: RHSErrorCode | null;
    view: RHSListView;

    resolveAndFetchRHSIssues: (overrides?: ResolveAndFetchArgs) => Promise<unknown>;
    loadMoreRHSIssues: () => Promise<unknown>;
    openRHSIssue: (key: string) => unknown;
    initRHSBoard: (instanceID: string) => unknown;
    fetchRHSBoard: () => unknown;
    selectRHSBoard: (board: RHSBoardRef | null) => unknown;
    setRHSListView: (view: RHSListView) => unknown;
    listRHSBoards: (name: string) => Promise<{data?: RHSBoardRef[]; error?: unknown}>;
    loadRHSIssueTransitions: (key: string) => Promise<{data?: RHSTransition[]; error?: unknown}>;
    moveRHSIssue: (key: string, transitionID: string) => Promise<{data?: unknown; error?: unknown}>;
};

type BodyKind = 'loading' | 'rate_limited' | 'invalid_query' | 'error' | 'empty' | 'list';

export function myIssuesBodyKind(args: {loading: boolean; issuesLength: number; error: RHSErrorCode | null}): BodyKind {
    if (args.loading && args.issuesLength === 0 && args.error === null) {
        return 'loading';
    }
    if (args.error === 'invalid_query') {
        return 'invalid_query';
    }
    if (args.error === 'rate_limited' && args.issuesLength === 0) {
        return 'rate_limited';
    }
    if (args.error !== null && args.issuesLength === 0) {
        return 'error';
    }
    if (args.issuesLength === 0) {
        return 'empty';
    }
    return 'list';
}

// foundLabel renders "Найдено 3", or "Найдено 20+" when Jira gives no total
// and more pages exist.
export function foundLabel(total: number | null, loaded: number, isLast: boolean): string {
    if (total !== null) {
        return RHS_STRINGS.found + ' ' + total;
    }
    return RHS_STRINGS.found + ' ' + loaded + (isLast ? '' : '+');
}

export default function MyIssues(props: Props): JSX.Element {
    const {
        instanceID,
        filter,
        query,
        issues,
        isLast,
        total,
        loading,
        error,
        errorMessage,
        loadedInstanceID,
        resolveAndFetchRHSIssues,
        loadMoreRHSIssues,
    } = props;

    const [nowMs] = useState(() => Date.now());
    const [searchOpen, setSearchOpen] = useState(query.trim() !== '');
    const [focusSignal, setFocusSignal] = useState(0);
    const [stripOpen, setStripOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);

    // Fetch on first mount unless this instance's list is already in the
    // store, and again whenever the active instance changes.
    const seenInstance = useRef<string | null>(null);
    useEffect(() => {
        if (!instanceID) {
            return;
        }
        props.initRHSBoard(instanceID);
        const firstRun = seenInstance.current === null;
        seenInstance.current = instanceID;
        const cached = loadedInstanceID === instanceID && issues.length > 0 && error === null && !props.stale;
        if (firstRun && cached) {
            return;
        }
        resolveAndFetchRHSIssues({instanceID});

    // Only the instance drives refetching; other props change on every fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instanceID]);

    // "/" anywhere in the panel opens and focuses the search.
    useEffect(() => {
        const onFocusSearch = () => {
            setSearchOpen(true);
            setFocusSignal((n) => n + 1);
        };
        window.addEventListener(RHS_SEARCH_EVENT, onFocusSearch);
        return () => window.removeEventListener(RHS_SEARCH_EVENT, onFocusSearch);
    }, []);

    const searching = query.trim() !== '';

    const onSelectFilter = (next: RHSFilter) => {
        if (next === filter && !searching) {
            return;
        }
        setSearchOpen(false);
        resolveAndFetchRHSIssues({instanceID, filter: next, query: ''});
    };

    const onSearch = (next: string) => {
        resolveAndFetchRHSIssues({instanceID, query: next});
    };

    const onRetry = () => {
        resolveAndFetchRHSIssues({instanceID});
        if (props.boardId) {
            props.fetchRHSBoard();
        }
    };

    const onLoadMore = () => {
        if (!loading && !isLast) {
            loadMoreRHSIssues();
        }
    };

    const onToggleSearch = () => {
        if (searchOpen && !searching) {
            setSearchOpen(false);
            return;
        }
        setSearchOpen(true);
        setFocusSignal((n) => n + 1);
    };

    const kind = myIssuesBodyKind({loading, issuesLength: issues.length, error});

    let body: JSX.Element;
    switch (kind) {
    case 'loading':
        body = <RHSSkeletonList/>;
        break;
    case 'invalid_query':
        body = <RHSQueryErrorState message={errorMessage}/>;
        break;
    case 'rate_limited':
        body = <RHSRateLimitedState onRetry={onRetry}/>;
        break;
    case 'error':
        body = <RHSErrorState onRetry={onRetry}/>;
        break;
    case 'empty':
        body = <RHSEmptyState message={searching ? RHS_STRINGS.emptySearch : RHS_STRINGS.emptyFilter}/>;
        break;
    case 'list':
        body = props.view === 'board' ? (
            <BoardView
                issues={issues}
                board={props.board && props.board.id === props.boardId ? props.board : null}
                nowMs={nowMs}
                isLast={isLast}
                loading={loading}
                onLoadMore={onLoadMore}
                onOpenIssue={props.openRHSIssue}
                loadTransitions={props.loadRHSIssueTransitions}
                moveIssue={props.moveRHSIssue}
            />
        ) : (
            <RHSIssueList
                issues={issues}
                loading={loading}
                isLast={isLast}
                error={error}
                onLoadMore={onLoadMore}
                onRetry={onRetry}
                onOpenIssue={props.openRHSIssue}
            />
        );
        break;
    default: {
        const exhaustive: never = kind;
        body = exhaustive;
    }
    }

    return (
        <div
            className='jira-rhs-my-issues'
            data-testid='rhs-my-issues'
        >
            <div className='jira-rhs-toolbar'>
                {props.boardId > 0 && (
                    <SprintStrip
                        boardName={props.boardName}
                        board={props.board && props.board.id === props.boardId ? props.board : null}
                        loading={props.boardLoading}
                        error={props.boardError}
                        expanded={props.view === 'board' || stripOpen}
                        canToggle={props.view !== 'board'}
                        nowMs={nowMs}
                        onToggle={() => setStripOpen(!stripOpen)}
                        onRetry={() => props.fetchRHSBoard()}
                    />
                )}
                <FilterBar
                    active={searching ? null : filter}
                    sort={props.sort}
                    view={props.view}
                    boardName={props.boardId ? props.boardName : ''}
                    searchOpen={searchOpen || searching}
                    onSelectFilter={onSelectFilter}
                    onSort={(sort) => resolveAndFetchRHSIssues({instanceID, sort})}
                    onView={(view) => props.setRHSListView(view)}
                    onToggleSearch={onToggleSearch}
                    onChooseBoard={() => setPickerOpen(true)}
                    onRemoveBoard={() => props.selectRHSBoard(null)}
                    onRefresh={onRetry}
                />
                {(searchOpen || searching) && (
                    <SearchBox
                        value={query}
                        onSearch={onSearch}
                        onRefresh={onRetry}
                        refreshing={loading}
                        focusSignal={focusSignal}
                        onEscapeEmpty={() => setSearchOpen(false)}
                    />
                )}
                {searching && kind === 'list' && (
                    <div
                        className='jira-rhs-found'
                        data-testid='rhs-found'
                    >
                        {foundLabel(total, issues.length, isLast)}
                    </div>
                )}
            </div>
            <div className='jira-rhs-body'>
                {pickerOpen ? (
                    <BoardPicker
                        selectedId={props.boardId}
                        listBoards={props.listRHSBoards}
                        onSelect={(board) => {
                            setPickerOpen(false);
                            props.selectRHSBoard(board);
                        }}
                        onClose={() => setPickerOpen(false)}
                    />
                ) : body}
            </div>
        </div>
    );
}
