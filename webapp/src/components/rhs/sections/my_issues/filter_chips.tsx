// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {RHSFilter, RHS_FILTERS} from 'types/rhs';

import {RHS_STRINGS} from '../../rhs_strings';

export const RHS_FILTER_LABELS: Record<RHSFilter, string> = {
    assigned: RHS_STRINGS.filterAssigned,
    reported: RHS_STRINGS.filterReported,
    watching: RHS_STRINGS.filterWatching,
    sprint: RHS_STRINGS.filterSprint,
};

export type Props = {

    // null while a search is shown: no chip is active then.
    active: RHSFilter | null;
    total: number | null;
    onSelect: (filter: RHSFilter) => void;
};

export default function FilterChips(props: Props): JSX.Element {
    return (
        <div
            className='jira-rhs-chips'
            role='group'
            aria-label={RHS_STRINGS.filtersLabel}
            data-testid='rhs-filter-chips'
        >
            {RHS_FILTERS.map((filter) => {
                const active = filter === props.active;
                const label = RHS_FILTER_LABELS[filter];
                return (
                    <button
                        key={filter}
                        type='button'
                        className={active ? 'jira-rhs-chip jira-rhs-chip--active' : 'jira-rhs-chip'}
                        aria-pressed={active}
                        data-testid={'rhs-filter-' + filter}
                        onClick={() => props.onSelect(filter)}
                    >
                        {label}
                        {active && props.total !== null && (
                            <span className='jira-rhs-chip-count'>{' · ' + props.total}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
