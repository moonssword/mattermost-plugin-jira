// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';

import {Post} from '@mattermost/types/posts';

import {RHSIssue} from 'types/rhs';

import {foundLabel} from '../sections/my_issues/my_issues';
import {rhsStatusClass} from '../rhs_issue_row';
import RHSIssueTypeIcon from '../rhs_issue_type_icon';
import {RHSLoadingState, RHSQueryErrorState} from '../rhs_states';
import {RHS_STRINGS} from '../rhs_strings';

export const RHS_ATTACH_SEARCH_DEBOUNCE_MS = 400;

type SearchResult = {data?: {issues: RHSIssue[]; total: number | null; isLast: boolean}; error?: {errorCode?: string; message?: string}};

export type Props = {
    postId: string;
    post: Post | null;
    postAuthor: string;
    closeRHSAttach: () => void;
    searchRHSAttachIssues: (query: string) => Promise<SearchResult>;
    attachPostToIssue: (postId: string, key: string) => Promise<{data?: unknown; error?: {message?: string}}>;
    openRHSIssue: (key: string) => unknown;
};

function submitLabel(sending: boolean, selected: string): string {
    if (sending) {
        return RHS_STRINGS.attachSending;
    }
    return selected ? RHS_STRINGS.attachSubmit.replace('{key}', selected) : RHS_STRINGS.attachChoose;
}

function messageExcerpt(message: string): string {
    const text = message.replace(/\s+/g, ' ').trim();
    return text.length > 200 ? text.slice(0, 199) + '…' : text;
}

// AttachView replaces the "Attach to Jira issue" modal: search an issue,
// pick it and add the message to it as a Jira comment.
export default function AttachView(props: Props): JSX.Element {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult['data'] | null>(null);
    const [searchError, setSearchError] = useState<SearchResult['error'] | null>(null);
    const [searching, setSearching] = useState(true);
    const [selected, setSelected] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState('');
    const latest = useRef(0);

    // A new post (another "Приложить к задаче") starts over.
    useEffect(() => {
        setSelected('');
        setDone('');
        setError('');
    }, [props.postId]);

    useEffect(() => {
        const requestNo = ++latest.current;
        setSearching(true);
        const timer = setTimeout(async () => {
            const result = await props.searchRHSAttachIssues(query.trim());
            if (requestNo !== latest.current) {
                return;
            }
            setSearching(false);
            setSearchError(result.error || null);
            setResults(result.data || null);
        }, query ? RHS_ATTACH_SEARCH_DEBOUNCE_MS : 0);
        return () => clearTimeout(timer);

    // The search action is a bound creator and stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    const onAttach = async () => {
        if (!selected || sending) {
            return;
        }
        setSending(true);
        setError('');
        const result = await props.attachPostToIssue(props.postId, selected);
        setSending(false);
        if (result.error) {
            setError(result.error.message || RHS_STRINGS.cardActionFailed);
            return;
        }
        setDone(selected);
    };

    const header = (
        <div className='jira-rhs-card-top'>
            <button
                type='button'
                className='jira-rhs-icon-button'
                aria-label={RHS_STRINGS.back}
                title={RHS_STRINGS.back}
                data-testid='rhs-attach-back'
                onClick={props.closeRHSAttach}
            >
                <i
                    className='icon icon-arrow-left'
                    aria-hidden={true}
                />
            </button>
            <span className='jira-rhs-attach-title'>{RHS_STRINGS.attachTitle}</span>
        </div>
    );

    if (done) {
        return (
            <div className='jira-rhs-card'>
                {header}
                <div
                    className='jira-rhs-placeholder'
                    data-testid='rhs-attach-done'
                >
                    <h4 className='jira-rhs-placeholder-title'>{RHS_STRINGS.attachDone.replace('{key}', done)}</h4>
                    <p className='jira-rhs-placeholder-text'>{RHS_STRINGS.attachDoneHint}</p>
                    <div className='jira-rhs-form-buttons'>
                        <button
                            type='button'
                            className='btn btn-primary'
                            data-testid='rhs-attach-open-card'
                            onClick={() => props.openRHSIssue(done)}
                        >
                            {RHS_STRINGS.createOpenCard}
                        </button>
                        <button
                            type='button'
                            className='btn btn-tertiary'
                            onClick={props.closeRHSAttach}
                        >
                            {RHS_STRINGS.attachClose}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    let list: React.ReactNode;
    if (searching && !results) {
        list = <RHSLoadingState/>;
    } else if (searchError && searchError.errorCode === 'invalid_query') {
        list = <RHSQueryErrorState message={searchError.message || ''}/>;
    } else if (searchError) {
        list = <p className='jira-rhs-muted jira-rhs-attach-note'>{RHS_STRINGS.error}</p>;
    } else if (results && results.issues.length === 0) {
        list = <p className='jira-rhs-muted jira-rhs-attach-note'>{query ? RHS_STRINGS.emptySearch : RHS_STRINGS.emptyFilter}</p>;
    } else if (results) {
        list = (
            <>
                <div
                    className='jira-rhs-found jira-rhs-attach-note'
                    data-testid='rhs-attach-found'
                >
                    {query ? foundLabel(results.total, results.issues.length, results.isLast) : RHS_STRINGS.attachMine}
                </div>
                <div
                    className='jira-rhs-attach-list'
                    role='listbox'
                    aria-label={RHS_STRINGS.attachChoose}
                >
                    {results.issues.map((issue) => {
                        const isSelected = issue.key === selected;
                        return (
                            <button
                                key={issue.key}
                                type='button'
                                role='option'
                                aria-selected={isSelected}
                                className={isSelected ? 'jira-rhs-attach-item jira-rhs-attach-item--selected' : 'jira-rhs-attach-item'}
                                data-testid={'rhs-attach-option-' + issue.key}
                                onClick={() => setSelected(issue.key)}
                            >
                                <RHSIssueTypeIcon
                                    issueType={issue.issueType}
                                    iconUrl={issue.issueTypeIconUrl}
                                />
                                <span className='jira-rhs-issue-main'>
                                    <span className='jira-rhs-issue-line1'>
                                        <span className='jira-rhs-issue-key'>{issue.key}</span>
                                        <span className={rhsStatusClass(issue.status.categoryKey)}>{issue.status.name}</span>
                                    </span>
                                    <span className='jira-rhs-issue-summary'>{issue.summary}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </>
        );
    }

    return (
        <div
            className='jira-rhs-card'
            data-testid='rhs-attach'
            onKeyDown={(event) => {
                if (event.key === 'Escape' && !event.defaultPrevented) {
                    props.closeRHSAttach();
                }
            }}
        >
            {header}
            <div className='jira-rhs-form-body'>
                {props.post ? (
                    <blockquote
                        className='jira-rhs-quote'
                        data-testid='rhs-attach-quote'
                    >
                        <b>{RHS_STRINGS.createFrom + (props.postAuthor ? ' ' + props.postAuthor : '')}</b>
                        <span>{messageExcerpt(props.post.message)}</span>
                    </blockquote>
                ) : (
                    <p className='jira-rhs-card-alert'>{RHS_STRINGS.attachPostMissing}</p>
                )}
                <div className='jira-rhs-search'>
                    <i
                        className='icon icon-magnify jira-rhs-search-icon'
                        aria-hidden={true}
                    />
                    <input
                        type='search'
                        className='jira-rhs-search-input'
                        placeholder={RHS_STRINGS.attachSearch}
                        aria-label={RHS_STRINGS.attachSearch}
                        data-testid='rhs-attach-search'
                        value={query}
                        autoFocus={true}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>
                {error && (
                    <div
                        className='jira-rhs-card-alert'
                        role='alert'
                        data-testid='rhs-attach-error'
                    >
                        {error}
                    </div>
                )}
                {list}
            </div>
            <div className='jira-rhs-form-footer'>
                <button
                    type='button'
                    className='btn btn-tertiary'
                    data-testid='rhs-attach-cancel'
                    onClick={props.closeRHSAttach}
                >
                    {RHS_STRINGS.cancel}
                </button>
                <button
                    type='button'
                    className='btn btn-primary'
                    data-testid='rhs-attach-submit'
                    disabled={!selected || sending || !props.post}
                    onClick={onAttach}
                >
                    {submitLabel(sending, selected)}
                </button>
            </div>
        </div>
    );
}
