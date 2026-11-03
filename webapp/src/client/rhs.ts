// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';

import {
    GetRHSIssuesParams,
    RHSErrorCode,
    RHSIssuesResponse,
    RHSStatusesResponse,
} from 'types/rhs';

import {buildQueryString} from './index';

export class RHSFetchError extends Error {
    errorCode: RHSErrorCode;
    statusCode: number;

    constructor(errorCode: RHSErrorCode, message: string, statusCode: number) {
        super(message);
        this.name = 'RHSFetchError';
        this.errorCode = errorCode;
        this.statusCode = statusCode;
    }
}

export function coerceRHSErrorCode(value: string): RHSErrorCode {
    switch (value) {
    case 'not_connected':
    case 'rate_limited':
    case 'not_authorized':
    case 'unsupported_instance':
    case 'invalid_request':
    case 'invalid_query':
    case 'internal_error':
        return value;
    default:
        return 'internal_error';
    }
}

export function parseRHSErrorBody(text: string, statusCode: number): RHSFetchError {
    try {
        const parsed = JSON.parse(text);
        if (
            parsed &&
            typeof parsed === 'object' &&
            typeof parsed.error === 'string'
        ) {
            const message = typeof parsed.message === 'string' && parsed.message ?
                parsed.message :
                parsed.error;
            return new RHSFetchError(coerceRHSErrorCode(parsed.error), message, statusCode);
        }
    } catch {
        // non-JSON body from a proxy or unexpected upstream error page
    }

    return new RHSFetchError('internal_error', text || '', statusCode);
}

const doFetchJSON = async <T>(url: string): Promise<T> => {
    const response = await fetch(url, Client4.getOptions({method: 'get'}));
    if (response.ok) {
        return response.json();
    }

    const text = await response.text();
    throw parseRHSErrorBody(text, response.status);
};

export function buildRHSIssuesQuery(params: GetRHSIssuesParams) {
    const query: {[key: string]: string} = {
        instance_id: params.instanceID,
        sort: params.sort,
        filter: params.filter,
    };
    const q = params.query.trim();
    if (q) {
        query.q = q;
    }
    if (params.nextPageToken) {
        query.next_page_token = params.nextPageToken;
    }

    return query;
}

function parseRHSIssuesResponse(raw: RHSIssuesResponse): RHSIssuesResponse {
    return {
        issues: raw.issues || [],
        nextPageToken: raw.nextPageToken || '',
        isLast: Boolean(raw.isLast),
        total: typeof raw.total === 'number' ? raw.total : null,
    };
}

export async function getRHSIssues(baseUrl: string, params: GetRHSIssuesParams): Promise<RHSIssuesResponse> {
    const raw = await doFetchJSON<RHSIssuesResponse>(
        `${baseUrl}/api/v2/rhs/issues${buildQueryString(buildRHSIssuesQuery(params))}`,
    );
    return parseRHSIssuesResponse(raw);
}

export function getRHSStatuses(baseUrl: string, instanceID: string): Promise<RHSStatusesResponse> {
    return doFetchJSON<RHSStatusesResponse>(
        `${baseUrl}/api/v2/rhs/statuses${buildQueryString({instance_id: instanceID})}`,
    );
}
