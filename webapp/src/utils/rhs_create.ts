// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const RHS_SUMMARY_MAX = 120;

// summaryFromMessage proposes an issue summary from a chat message: the first
// non-empty line without markdown decoration, cut at a word boundary.
export function summaryFromMessage(message: string, max = RHS_SUMMARY_MAX): string {
    const line = message.split('\n').map((l) => l.trim()).find((l) => l.length > 0) || '';
    const plain = line
        .replace(/^(#+|>|[-*+]|\d+\.)\s+/, '')
        .replace(/[*_~`]+/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
    if (plain.length <= max) {
        return plain;
    }
    const cut = plain.slice(0, max - 1);
    const space = cut.lastIndexOf(' ');
    return (space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, '') + '…';
}
