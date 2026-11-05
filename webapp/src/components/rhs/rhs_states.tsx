// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {RHS_STRINGS} from './rhs_strings';

export function RHSEmptyState(props: {message?: string}): JSX.Element {
    return (
        <div
            className='jira-rhs-state'
            data-testid='rhs-state-empty'
        >
            <p>{props.message || RHS_STRINGS.empty}</p>
        </div>
    );
}

// Jira rejected the user's search, usually a JQL syntax error; show its text.
export function RHSQueryErrorState(props: {message: string}): JSX.Element {
    return (
        <div
            className='jira-rhs-state jira-rhs-state--query-error'
            data-testid='rhs-state-query-error'
            role='alert'
        >
            <p className='jira-rhs-state-title'>{RHS_STRINGS.queryRejected}</p>
            {props.message && <p className='jira-rhs-state-detail'>{props.message}</p>}
        </div>
    );
}

function RHSRetryState(props: {testId: string; message: string; onRetry: () => void}): JSX.Element {
    return (
        <div
            className='jira-rhs-state'
            data-testid={props.testId}
        >
            <p>{props.message}</p>
            <button
                type='button'
                className='btn btn-secondary btn-sm'
                onClick={props.onRetry}
            >
                {RHS_STRINGS.retry}
            </button>
        </div>
    );
}

export function RHSErrorState(props: {onRetry: () => void}): JSX.Element {
    return (
        <RHSRetryState
            testId='rhs-state-error'
            message={RHS_STRINGS.error}
            onRetry={props.onRetry}
        />
    );
}

export function RHSNotConnectedState(props: {onConnect: () => void}): JSX.Element {
    return (
        <div
            className='jira-rhs-state'
            data-testid='rhs-state-not-connected'
        >
            <p>{RHS_STRINGS.notConnected}</p>
            <button
                type='button'
                className='btn btn-primary'
                data-testid='rhs-connect'
                onClick={props.onConnect}
            >
                {RHS_STRINGS.connect}
            </button>
        </div>
    );
}

export function RHSRateLimitedState(props: {onRetry: () => void}): JSX.Element {
    return (
        <RHSRetryState
            testId='rhs-state-rate-limited'
            message={RHS_STRINGS.rateLimited}
            onRetry={props.onRetry}
        />
    );
}
