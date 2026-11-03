// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHSIssuesResponse} from 'types/rhs';

import {RHSFetchError, getRHSIssues, getRHSStatuses} from './rhs';

const fetchMock = global.fetch as jest.Mock;

const emptyIssues: RHSIssuesResponse = {
    issues: [],
    nextPageToken: '',
    isLast: true,
    total: 0,
};

describe('client/rhs', () => {
    beforeEach(() => {
        fetchMock.mockReset();
    });

    afterEach(() => {
        fetchMock.mockReset();
    });

    test('getRHSIssues returns JSON on a 2xx response', async () => {
        fetchMock.mockImplementation(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve(emptyIssues),
        }));

        const result = await getRHSIssues('/plugins/jira', {
            instanceID: 'https://x.atlassian.net',
            filter: 'assigned' as const,
            query: '',
            sort: 'updated',
        });
        expect(result).toEqual(emptyIssues);
    });

    test('getRHSIssues surfaces a typed error code from a JSON error body', async () => {
        fetchMock.mockImplementation(() => Promise.resolve({
            ok: false,
            status: 401,
            text: () => Promise.resolve(JSON.stringify({
                error: 'not_connected',
                message: 'Jira account is not connected',
            })),
        }));

        const params = {
            instanceID: 'https://x.atlassian.net',
            filter: 'assigned' as const,
            query: '',
            sort: 'updated' as const,
        };
        await expect(getRHSIssues('/plugins/jira', params)).rejects.toMatchObject({
            name: 'RHSFetchError',
            errorCode: 'not_connected',
            message: 'Jira account is not connected',
            statusCode: 401,
        });
        await expect(getRHSIssues('/plugins/jira', params)).rejects.toBeInstanceOf(RHSFetchError);
    });

    test('getRHSIssues falls back to text when the body is not JSON', async () => {
        fetchMock.mockImplementation(() => Promise.resolve({
            ok: false,
            status: 502,
            text: () => Promise.resolve('<html>bad gateway</html>'),
        }));

        try {
            await getRHSIssues('/plugins/jira', {
                instanceID: 'https://x.atlassian.net',
                filter: 'assigned' as const,
                query: '',
                sort: 'updated',
            });
            throw new Error('expected getRHSIssues to reject');
        } catch (error) {
            expect(error).toBeInstanceOf(RHSFetchError);
            expect(error).not.toBeInstanceOf(SyntaxError);
            expect((error as RHSFetchError).errorCode).toBe('internal_error');
            expect((error as RHSFetchError).message).toBe('<html>bad gateway</html>');
        }
    });

    test('getRHSIssues falls back to text for checkAuth plain 401', async () => {
        fetchMock.mockImplementation(() => Promise.resolve({
            ok: false,
            status: 401,
            text: () => Promise.resolve('Not authorized\n'),
        }));

        try {
            await getRHSIssues('/plugins/jira', {
                instanceID: 'https://x.atlassian.net',
                filter: 'assigned' as const,
                query: '',
                sort: 'updated',
            });
            throw new Error('expected getRHSIssues to reject');
        } catch (error) {
            expect(error).toBeInstanceOf(RHSFetchError);
            expect((error as RHSFetchError).errorCode).toBe('internal_error');
            expect((error as RHSFetchError).message).toContain('Not authorized');
        }
    });

    test('getRHSIssues sends the filter and no search for an empty query', async () => {
        fetchMock.mockImplementation(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve(emptyIssues),
        }));

        await getRHSIssues('/plugins/jira', {
            instanceID: 'https://x.atlassian.net',
            filter: 'watching',
            query: '   ',
            sort: 'created',
        });

        const url = fetchMock.mock.calls[0][0] as string;
        expect(url).toContain('/plugins/jira/api/v2/rhs/issues');
        expect(url).toContain('instance_id=');
        expect(url).toContain('filter=watching');
        expect(url).toContain('sort=created');
        expect(url).not.toContain('q=');
        expect(url).not.toContain('tab=');
        expect(url).not.toContain('next_page_token');
        expect(url).not.toContain('/api/v2/api/v2');
    });

    test('getRHSIssues sends a trimmed search and the page token', async () => {
        fetchMock.mockImplementation(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve(emptyIssues),
        }));

        await getRHSIssues('/plugins/jira', {
            instanceID: 'https://x.atlassian.net',
            filter: 'assigned',
            query: ' project = BACK ',
            sort: 'updated',
            nextPageToken: '20',
        });

        const url = fetchMock.mock.calls[0][0] as string;
        expect(url).toContain('q=' + encodeURIComponent('project = BACK'));
        expect(url).toContain('next_page_token=20');
    });

    test('getRHSIssues maps a missing total to null and keeps a number', async () => {
        fetchMock.mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({issues: [], nextPageToken: '', isLast: true}),
        }));
        const params = {instanceID: 'x', filter: 'assigned' as const, query: '', sort: 'updated' as const};
        expect((await getRHSIssues('/plugins/jira', params)).total).toBeNull();

        fetchMock.mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({issues: [], nextPageToken: '', isLast: true, total: 12}),
        }));
        expect((await getRHSIssues('/plugins/jira', params)).total).toBe(12);
    });

    test('getRHSIssues keeps the invalid_query code and Jira message', async () => {
        fetchMock.mockImplementation(() => Promise.resolve({
            ok: false,
            status: 400,
            text: () => Promise.resolve(JSON.stringify({error: 'invalid_query', message: 'Unable to parse JQL'})),
        }));
        await expect(getRHSIssues('/plugins/jira', {instanceID: 'x', filter: 'assigned', query: 'a = ', sort: 'updated'})).rejects.toMatchObject({
            errorCode: 'invalid_query',
            message: 'Unable to parse JQL',
        });
    });

    test('getRHSStatuses calls /api/v2/rhs/statuses', async () => {
        fetchMock.mockImplementation(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({statuses: [], categories: []}),
        }));

        await getRHSStatuses('/plugins/jira', 'https://x.atlassian.net');

        expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.anything());
        const url = fetchMock.mock.calls[0][0] as string;
        expect(url).toContain('/plugins/jira/api/v2/rhs/statuses');
        expect(url).toContain('instance_id=');
    });
});
