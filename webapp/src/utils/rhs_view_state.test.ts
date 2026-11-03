// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHSViewState} from 'types/rhs';

import {loadRHSViewState, saveRHSViewState, validateRHSViewState} from './rhs_view_state';

describe('rhs_view_state', () => {
    afterEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
    });

    test('rhs_view_state round-trips instance filter sort', () => {
        const view: RHSViewState = {
            instance: 'https://example.atlassian.net',
            filter: 'watching',
            sort: 'created',
        };

        saveRHSViewState('u1', view);
        expect(loadRHSViewState('u1')).toEqual(view);
    });

    test('rhs_view_state isolates keys by user id', () => {
        saveRHSViewState('u1', {instance: 'https://example.atlassian.net', filter: 'assigned', sort: 'updated'});
        expect(loadRHSViewState('u2')).toBeNull();
    });

    test('loadRHSViewState returns null when localStorage throws', () => {
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('quota');
        });

        expect(loadRHSViewState('u1')).toBeNull();
    });

    test('saveRHSViewState swallows a localStorage throw', () => {
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota');
        });

        expect(() => {
            saveRHSViewState('u1', {instance: 'https://example.atlassian.net', filter: 'assigned', sort: 'updated'});
        }).not.toThrow();
    });

    test('validateRHSViewState upgrades an old entry with a status tab to the default filter', () => {
        expect(validateRHSViewState({
            instance: 'x',
            tab: {kind: 'category', name: 'In Progress', key: 'indeterminate'},
            sort: 'created',
        })).toEqual({instance: 'x', filter: 'assigned', sort: 'created'});
    });

    test('validateRHSViewState replaces an unknown filter with the default', () => {
        expect(validateRHSViewState({instance: 'x', filter: 'everything', sort: 'updated'})).toEqual({
            instance: 'x',
            filter: 'assigned',
            sort: 'updated',
        });
    });

    test('validateRHSViewState rejects a sort outside updated or created', () => {
        expect(validateRHSViewState({instance: 'x', filter: 'assigned', sort: 'priority'})).toBeNull();
    });

    test('validateRHSViewState rejects a missing instance', () => {
        expect(validateRHSViewState({filter: 'assigned', sort: 'updated'})).toBeNull();
        expect(validateRHSViewState(null)).toBeNull();
    });
});
