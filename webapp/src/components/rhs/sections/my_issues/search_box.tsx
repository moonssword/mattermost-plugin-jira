// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';

import {RHS_STRINGS} from '../../rhs_strings';

export const RHS_SEARCH_DEBOUNCE_MS = 500;

export type Props = {
    value: string;
    onSearch: (query: string) => void;
    onRefresh: () => void;
    refreshing: boolean;
};

// Search box with debounce: typing searches after a pause, Enter searches at
// once, Escape or the clear button returns to the quick filter.
export default function SearchBox(props: Props): JSX.Element {
    const [text, setText] = useState(props.value);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSent = useRef(props.value);

    // Follow outside changes, for example a chip click clearing the search.
    useEffect(() => {
        if (props.value !== lastSent.current) {
            lastSent.current = props.value;
            setText(props.value);
        }
    }, [props.value]);

    useEffect(() => () => {
        if (timer.current) {
            clearTimeout(timer.current);
        }
    }, []);

    const send = (next: string) => {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
        const trimmed = next.trim();
        if (trimmed === lastSent.current.trim()) {
            return;
        }
        lastSent.current = trimmed;
        props.onSearch(trimmed);
    };

    const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const next = event.target.value;
        setText(next);
        if (timer.current) {
            clearTimeout(timer.current);
        }
        timer.current = setTimeout(() => send(next), RHS_SEARCH_DEBOUNCE_MS);
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            send(text);
        } else if (event.key === 'Escape' && text) {
            event.preventDefault();
            event.stopPropagation();
            setText('');
            send('');
        }
    };

    const onClear = () => {
        setText('');
        send('');
    };

    return (
        <div className='jira-rhs-search-row'>
            <div className='jira-rhs-search'>
                <i
                    className='icon icon-magnify jira-rhs-search-icon'
                    aria-hidden={true}
                />
                <input
                    type='search'
                    className='jira-rhs-search-input'
                    placeholder={RHS_STRINGS.searchPlaceholder}
                    aria-label={RHS_STRINGS.searchLabel}
                    data-testid='rhs-search'
                    value={text}
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                />
                {text && (
                    <button
                        type='button'
                        className='jira-rhs-icon-button jira-rhs-search-clear'
                        aria-label={RHS_STRINGS.searchClear}
                        data-testid='rhs-search-clear'
                        onClick={onClear}
                    >
                        <i
                            className='icon icon-close-circle'
                            aria-hidden={true}
                        />
                    </button>
                )}
            </div>
            <button
                type='button'
                className='jira-rhs-icon-button'
                aria-label={RHS_STRINGS.refresh}
                title={RHS_STRINGS.refresh}
                data-testid='rhs-refresh'
                disabled={props.refreshing}
                onClick={props.onRefresh}
            >
                <i
                    className={props.refreshing ? 'icon icon-refresh jira-rhs-spinner' : 'icon icon-refresh'}
                    aria-hidden={true}
                />
            </button>
        </div>
    );
}
