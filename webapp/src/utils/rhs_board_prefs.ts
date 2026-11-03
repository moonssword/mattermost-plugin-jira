// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHSBoardPrefs, isRHSListView} from 'types/rhs_board';

const storagePrefix = 'jira:rhs-board:';

export const RHS_DEFAULT_BOARD_PREFS: RHSBoardPrefs = {boardId: 0, boardName: '', view: 'list'};

export function rhsBoardStorageKey(userId: string, instanceID: string): string {
    return storagePrefix + userId + ':' + instanceID;
}

export function validateRHSBoardPrefs(raw: unknown): RHSBoardPrefs {
    if (!raw || typeof raw !== 'object') {
        return RHS_DEFAULT_BOARD_PREFS;
    }
    const c = raw as {boardId?: unknown; boardName?: unknown; view?: unknown};
    const boardId = typeof c.boardId === 'number' && Number.isInteger(c.boardId) && c.boardId > 0 ? c.boardId : 0;
    return {
        boardId,
        boardName: boardId && typeof c.boardName === 'string' ? c.boardName : '',
        view: isRHSListView(c.view) ? c.view : 'list',
    };
}

export function loadRHSBoardPrefs(userId: string, instanceID: string): RHSBoardPrefs {
    if (!userId || !instanceID) {
        return RHS_DEFAULT_BOARD_PREFS;
    }
    try {
        const raw = localStorage.getItem(rhsBoardStorageKey(userId, instanceID));
        return raw ? validateRHSBoardPrefs(JSON.parse(raw)) : RHS_DEFAULT_BOARD_PREFS;
    } catch {
        return RHS_DEFAULT_BOARD_PREFS;
    }
}

export function saveRHSBoardPrefs(userId: string, instanceID: string, prefs: RHSBoardPrefs): void {
    if (!userId || !instanceID) {
        return;
    }
    try {
        localStorage.setItem(rhsBoardStorageKey(userId, instanceID), JSON.stringify(prefs));
    } catch {
        // ignore quota / private-mode
    }
}
