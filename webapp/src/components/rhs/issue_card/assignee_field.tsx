// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';

import {RHSAssignTarget, RHSUser} from 'types/rhs_issue';

import RHSAvatar from '../rhs_avatar';
import {RHS_STRINGS} from '../rhs_strings';

export const RHS_ASSIGNEE_SEARCH_DEBOUNCE_MS = 300;

export type Props = {
    assignee: RHSUser | null;
    busy: boolean;
    onAssign: (target: RHSAssignTarget) => void;
    searchUsers: (query: string) => Promise<{data?: RHSUser[]; error?: unknown}>;
};

export function RHSUserLabel(props: {user: RHSUser | null}): JSX.Element {
    if (!props.user) {
        return <span className='jira-rhs-muted'>{RHS_STRINGS.unassigned}</span>;
    }
    return (
        <span className='jira-rhs-user'>
            <RHSAvatar name={props.user.displayName}/>
            <span>{props.user.displayName}</span>
        </span>
    );
}

// Assignee with an inline picker: search Jira users assignable to the issue,
// pick one or "Не назначено".
export default function AssigneeField(props: Props): JSX.Element {
    const [editing, setEditing] = useState(false);
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState<RHSUser[] | null>(null);
    const latest = useRef(0);

    useEffect(() => {
        if (!editing) {
            return () => {
                // nothing to clean up
            };
        }
        const text = query.trim();
        if (!text) {
            setUsers(null);
            return () => {
                // nothing to clean up
            };
        }
        const requestNo = ++latest.current;
        const timer = setTimeout(async () => {
            const result = await props.searchUsers(text);
            if (requestNo === latest.current) {
                setUsers(result.data || []);
            }
        }, RHS_ASSIGNEE_SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);

    // searchUsers is a bound action creator and stable for the card's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, editing]);

    const close = () => {
        setEditing(false);
        setQuery('');
        setUsers(null);
    };

    const choose = (target: RHSAssignTarget) => {
        close();
        props.onAssign(target);
    };

    if (!editing) {
        return (
            <div className='jira-rhs-assignee'>
                <RHSUserLabel user={props.assignee}/>
                <button
                    type='button'
                    className='jira-rhs-icon-button'
                    aria-label={RHS_STRINGS.changeAssignee}
                    title={RHS_STRINGS.changeAssignee}
                    data-testid='rhs-card-assignee-edit'
                    disabled={props.busy}
                    onClick={() => setEditing(true)}
                >
                    <i
                        className={props.busy ? 'icon icon-refresh jira-rhs-spinner' : 'icon icon-pencil-outline'}
                        aria-hidden={true}
                    />
                </button>
            </div>
        );
    }

    return (
        <div
            className='jira-rhs-assignee-picker'
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    event.stopPropagation();
                    close();
                }
            }}
        >
            <input
                type='text'
                className='jira-rhs-search-input jira-rhs-search-input--plain'
                placeholder={RHS_STRINGS.assigneeSearch}
                aria-label={RHS_STRINGS.assigneeSearch}
                data-testid='rhs-card-assignee-search'
                value={query}
                autoFocus={true}
                onChange={(event) => setQuery(event.target.value)}
            />
            <div
                className='jira-rhs-picker-list'
                role='listbox'
            >
                <button
                    type='button'
                    role='option'
                    aria-selected={false}
                    className='jira-rhs-popover-item'
                    data-testid='rhs-card-unassign'
                    onClick={() => choose({nobody: true})}
                >
                    <span className='jira-rhs-muted'>{RHS_STRINGS.unassigned}</span>
                </button>
                {users === null && (
                    <div className='jira-rhs-popover-empty'>{RHS_STRINGS.assigneeTypeHint}</div>
                )}
                {users !== null && users.length === 0 && (
                    <div className='jira-rhs-popover-empty'>{RHS_STRINGS.assigneeNoResults}</div>
                )}
                {users !== null && users.map((user) => (
                    <button
                        key={user.accountId || user.name}
                        type='button'
                        role='option'
                        aria-selected={false}
                        className='jira-rhs-popover-item'
                        data-testid={'rhs-card-assignee-option-' + (user.accountId || user.name)}
                        onClick={() => choose({user})}
                    >
                        <RHSUserLabel user={user}/>
                        {user.name && <span className='jira-rhs-popover-hint'>{user.name}</span>}
                    </button>
                ))}
            </div>
            <button
                type='button'
                className='btn btn-tertiary btn-sm'
                onClick={close}
            >
                {RHS_STRINGS.cancel}
            </button>
        </div>
    );
}
