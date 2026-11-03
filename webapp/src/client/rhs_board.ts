// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHSBoard, RHSBoardRef} from 'types/rhs_board';
import {RHSTransition} from 'types/rhs_issue';

import {rhsRequest} from './rhs';

import {buildQueryString} from './index';

export async function getRHSBoards(baseUrl: string, instanceID: string, name: string): Promise<RHSBoardRef[]> {
    const query: {[key: string]: string} = {instance_id: instanceID};
    if (name.trim()) {
        query.q = name.trim();
    }
    const data = await rhsRequest<{boards: RHSBoardRef[] | null}>(`${baseUrl}/api/v2/rhs/boards${buildQueryString(query)}`);
    return data.boards || [];
}

export async function getRHSBoard(baseUrl: string, instanceID: string, boardID: number): Promise<RHSBoard> {
    const board = await rhsRequest<RHSBoard>(`${baseUrl}/api/v2/rhs/board${buildQueryString({instance_id: instanceID, board_id: String(boardID)})}`);
    return {...board, columns: board.columns || []};
}

export async function getRHSIssueTransitions(baseUrl: string, instanceID: string, key: string): Promise<RHSTransition[]> {
    const data = await rhsRequest<{transitions: RHSTransition[] | null}>(`${baseUrl}/api/v2/rhs/issue/transitions${buildQueryString({instance_id: instanceID, key})}`);
    return data.transitions || [];
}
