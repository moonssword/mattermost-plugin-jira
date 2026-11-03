// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {formatRHSRelativeTime, formatRHSShortDate} from './rhs_time';

const nowMs = Date.parse('2026-01-02T01:00:00Z');

describe('rhs_time', () => {
    test('formatRHSRelativeTime returns empty string for empty or invalid input', () => {
        expect(formatRHSRelativeTime('', nowMs)).toBe('');
        expect(formatRHSRelativeTime('not-a-date', nowMs)).toBe('');
    });

    test('formatRHSRelativeTime returns just now under one minute', () => {
        expect(formatRHSRelativeTime('2026-01-02T00:59:30Z', nowMs)).toBe('только что');
    });

    test('formatRHSRelativeTime returns Nm ago under one hour', () => {
        expect(formatRHSRelativeTime('2026-01-02T00:15:00Z', nowMs)).toBe('45 мин назад');
    });

    test('formatRHSRelativeTime returns Nh ago under one day', () => {
        expect(formatRHSRelativeTime('2026-01-01T20:00:00Z', nowMs)).toBe('5 ч назад');
    });

    test('formatRHSRelativeTime returns days under one week', () => {
        expect(formatRHSRelativeTime('2025-12-30T00:00:00Z', nowMs)).toBe('3 дн назад');
    });

    test('formatRHSRelativeTime returns a short date after one week', () => {
        expect(formatRHSRelativeTime('2025-12-20T00:00:00Z', nowMs)).toBe('20 дек 2025');
    });

    test('formatRHSShortDate omits the current year', () => {
        expect(formatRHSShortDate(Date.parse('2026-11-07T10:00:00Z'), Date.parse('2026-11-20T00:00:00Z'))).toBe('7 ноя');
    });
});
