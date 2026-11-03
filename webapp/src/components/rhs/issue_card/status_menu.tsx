// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';

import {RHSIssueStatus} from 'types/rhs';
import {RHSTransition} from 'types/rhs_issue';

import {rhsStatusClass} from '../rhs_issue_row';
import {RHS_STRINGS} from '../rhs_strings';

export type Props = {
    status: RHSIssueStatus;
    transitions: RHSTransition[];
    busy: boolean;
    onTransition: (transitionID: string) => void;
};

// Status button with the transitions Jira allows from the current status.
export default function StatusMenu(props: Props): JSX.Element {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return () => {
                // nothing to clean up
            };
        }
        const onDocClick = (event: MouseEvent) => {
            if (root.current && !root.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    const choose = (id: string) => {
        setOpen(false);
        props.onTransition(id);
    };

    return (
        <div
            className='jira-rhs-status-menu'
            ref={root}
            onKeyDown={(event) => {
                if (event.key === 'Escape' && open) {
                    event.stopPropagation();
                    setOpen(false);
                }
            }}
        >
            <button
                type='button'
                className='jira-rhs-status-button'
                aria-haspopup='menu'
                aria-expanded={open}
                aria-label={RHS_STRINGS.changeStatus}
                data-testid='rhs-card-status'
                disabled={props.busy}
                onClick={() => setOpen(!open)}
            >
                <span className={rhsStatusClass(props.status.categoryKey)}>{props.status.name}</span>
                <i
                    className={props.busy ? 'icon icon-refresh jira-rhs-spinner' : 'icon icon-chevron-down'}
                    aria-hidden={true}
                />
            </button>
            {open && (
                <div
                    className='jira-rhs-popover'
                    role='menu'
                    data-testid='rhs-card-transitions'
                >
                    <div className='jira-rhs-popover-title'>{RHS_STRINGS.transitions}</div>
                    {props.transitions.length === 0 && (
                        <div className='jira-rhs-popover-empty'>{RHS_STRINGS.noTransitions}</div>
                    )}
                    {props.transitions.map((transition) => (
                        <button
                            key={transition.id}
                            type='button'
                            role='menuitem'
                            className='jira-rhs-popover-item'
                            data-testid={'rhs-card-transition-' + transition.id}
                            onClick={() => choose(transition.id)}
                        >
                            <span className={rhsStatusClass(transition.to.categoryKey)}>{transition.to.name}</span>
                            {transition.name !== transition.to.name && (
                                <span className='jira-rhs-popover-hint'>{transition.name}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
