// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    RHSFilter,
    RHSSort,
    RHS_BOARD_FILTERS,
    RHS_FILTERS,
} from 'types/rhs';
import {RHSListView} from 'types/rhs_board';

import RHSMenu, {RHSMenuItem} from '../../rhs_menu';
import {RHS_STRINGS} from '../../rhs_strings';

export const RHS_FILTER_LABELS: Record<RHSFilter, string> = {
    get board() {
        return RHS_STRINGS.filterBoard;
    },
    get assigned() {
        return RHS_STRINGS.filterAssigned;
    },
    get reported() {
        return RHS_STRINGS.filterReported;
    },
    get watching() {
        return RHS_STRINGS.filterWatching;
    },
    get sprint() {
        return RHS_STRINGS.filterSprint;
    },
};

export type Props = {

    // null while a search is shown: no filter is active then.
    active: RHSFilter | null;
    sort: RHSSort;
    view: RHSListView;
    boardName: string;
    searchOpen: boolean;
    onSelectFilter: (filter: RHSFilter) => void;
    onSort: (sort: RHSSort) => void;
    onView: (view: RHSListView) => void;
    onToggleSearch: () => void;
    onChooseBoard: () => void;
    onRemoveBoard: () => void;
    onRefresh: () => void;
};

// FilterBar is the single row under the tabs: the quick filter as a menu,
// the chosen board, and search, sort and list/board switches.
export default function FilterBar(props: Props): JSX.Element {
    const filterItems: RHSMenuItem[] = (props.boardName ? RHS_BOARD_FILTERS : RHS_FILTERS).map((filter) => ({
        id: filter,
        label: RHS_FILTER_LABELS[filter],
        checked: filter === props.active,
        onSelect: () => props.onSelectFilter(filter),
    }));
    filterItems.push({
        id: 'board',
        label: props.boardName ? RHS_STRINGS.boardChange : RHS_STRINGS.boardChoose,
        separated: true,
        onSelect: props.onChooseBoard,
    });
    if (props.boardName) {
        filterItems.push({id: 'board-remove', label: RHS_STRINGS.boardRemove, onSelect: props.onRemoveBoard});
    }
    filterItems.push({id: 'refresh', label: RHS_STRINGS.refresh, separated: true, onSelect: props.onRefresh});

    const sortItems: RHSMenuItem[] = [
        {id: 'updated', label: RHS_STRINGS.sortNewestUpdated, checked: props.sort === 'updated', onSelect: () => props.onSort('updated')},
        {id: 'created', label: RHS_STRINGS.sortNewestCreated, checked: props.sort === 'created', onSelect: () => props.onSort('created')},
    ];

    return (
        <div
            className='jira-rhs-fbar'
            data-testid='rhs-filter-bar'
        >
            <RHSMenu
                label={RHS_STRINGS.filtersLabel}
                items={filterItems}
                buttonClassName={'jira-rhs-pill' + (props.active ? '' : ' jira-rhs-pill--muted')}
                testId='rhs-filter-menu'
            >
                <i
                    className='icon icon-filter-variant'
                    aria-hidden={true}
                />
                <span className='jira-rhs-pill-text'>{props.active ? RHS_FILTER_LABELS[props.active] : RHS_STRINGS.filterMenu}</span>
                <i
                    className='icon icon-chevron-down'
                    aria-hidden={true}
                />
            </RHSMenu>
            {props.boardName && (
                <button
                    type='button'
                    className='jira-rhs-pill jira-rhs-pill--board'
                    title={RHS_STRINGS.boardChange}
                    data-testid='rhs-board-pill'
                    onClick={props.onChooseBoard}
                >
                    <span className='jira-rhs-pill-text'>{props.boardName}</span>
                </button>
            )}
            <span className='jira-rhs-fbar-tools'>
                <button
                    type='button'
                    className={'jira-rhs-icon-button' + (props.searchOpen ? ' jira-rhs-icon-button--on' : '')}
                    aria-label={RHS_STRINGS.searchOpen}
                    aria-pressed={props.searchOpen}
                    title={RHS_STRINGS.searchOpen}
                    data-testid='rhs-search-toggle'
                    onClick={props.onToggleSearch}
                >
                    <i
                        className='icon icon-magnify'
                        aria-hidden={true}
                    />
                </button>
                <RHSMenu
                    label={RHS_STRINGS.sortLabel}
                    title={RHS_STRINGS.sortLabel}
                    items={sortItems}
                    align='right'
                    buttonClassName='jira-rhs-icon-button'
                    testId='rhs-sort-menu'
                >
                    <i
                        className='icon icon-sort-ascending'
                        aria-hidden={true}
                    />
                </RHSMenu>
                <span
                    className='jira-rhs-viewswitch'
                    role='group'
                    aria-label={RHS_STRINGS.viewLabel}
                >
                    <button
                        type='button'
                        className={'jira-rhs-icon-button' + (props.view === 'list' ? ' jira-rhs-icon-button--on' : '')}
                        aria-pressed={props.view === 'list'}
                        aria-label={RHS_STRINGS.viewList}
                        title={RHS_STRINGS.viewList}
                        data-testid='rhs-view-list'
                        onClick={() => props.onView('list')}
                    >
                        <i
                            className='icon icon-format-list-bulleted'
                            aria-hidden={true}
                        />
                    </button>
                    <button
                        type='button'
                        className={'jira-rhs-icon-button' + (props.view === 'board' ? ' jira-rhs-icon-button--on' : '')}
                        aria-pressed={props.view === 'board'}
                        aria-label={RHS_STRINGS.viewBoard}
                        title={RHS_STRINGS.viewBoard}
                        data-testid='rhs-view-board'
                        onClick={() => props.onView('board')}
                    >
                        <i
                            className='icon icon-kanban'
                            aria-hidden={true}
                        />
                    </button>
                </span>
            </span>
        </div>
    );
}
