// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GetRHSIssuesParams} from 'types/rhs';
import {RHSLanesResponse} from 'types/rhs_board';

import {buildRHSIssuesQuery, rhsRequest} from './rhs';

import {buildQueryString} from './index';

// getRHSLanes counts the issues of every column of the board view for the
// current filter or search.
export async function getRHSLanes(baseUrl: string, params: GetRHSIssuesParams): Promise<RHSLanesResponse> {
    const query = buildRHSIssuesQuery({...params, nextPageToken: '', lane: ''});
    delete query.estimate_field;
    const raw = await rhsRequest<Partial<RHSLanesResponse>>(`${baseUrl}/api/v2/rhs/lanes${buildQueryString(query)}`);
    return {
        supported: Boolean(raw.supported),
        lanes: (raw.lanes || []).map((lane) => ({
            id: lane.id,
            count: typeof lane.count === 'number' ? lane.count : null,
            categoryKey: lane.categoryKey || '',
        })),
    };
}
