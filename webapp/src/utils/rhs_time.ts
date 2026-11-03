// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;
const weekMs = 7 * dayMs;

const shortMonths = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

// formatRHSShortDate renders "7 ноя" for the current year and "7 ноя 2025"
// otherwise. UTC keeps the output stable across time zones in tests.
export function formatRHSShortDate(thenMs: number, nowMs: number): string {
    const then = new Date(thenMs);
    const now = new Date(nowMs);
    const base = then.getUTCDate() + ' ' + shortMonths[then.getUTCMonth()];
    if (then.getUTCFullYear() === now.getUTCFullYear()) {
        return base;
    }
    return base + ' ' + then.getUTCFullYear();
}

export function formatRHSRelativeTime(iso: string, nowMs: number): string {
    if (!iso) {
        return '';
    }
    const then = Date.parse(iso);
    if (Number.isNaN(then)) {
        return '';
    }
    const delta = Math.max(0, nowMs - then);
    if (delta < minuteMs) {
        return 'только что';
    }
    if (delta < hourMs) {
        return Math.floor(delta / minuteMs) + ' мин назад';
    }
    if (delta < dayMs) {
        return Math.floor(delta / hourMs) + ' ч назад';
    }
    if (delta < weekMs) {
        return Math.floor(delta / dayMs) + ' дн назад';
    }
    return formatRHSShortDate(then, nowMs);
}
