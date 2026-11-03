// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {Dispatch, bindActionCreators} from 'redux';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/common';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {
    clearRHSCreate,
    createIssue,
    fetchJiraIssueMetadataForProjects,
    fetchJiraProjectMetadata,
    openRHSIssue,
} from 'actions';
import {getRHSCreatePrefill} from 'selectors';

import {GlobalState} from 'types/store';

import CreateSection, {Props} from './create_section';

type OwnProps = Pick<Props, 'instanceID'>;
type DispatchProps = Pick<Props, 'clearRHSCreate' | 'createIssue' | 'fetchJiraIssueMetadataForProjects' | 'fetchJiraProjectMetadata' | 'openRHSIssue'>;

const mapStateToProps = (state: GlobalState) => {
    const prefill = getRHSCreatePrefill(state);
    const post = prefill.postId ? getPost(state, prefill.postId) || null : null;
    const author = post ? getUser(state, post.user_id) : null;
    return {
        prefill,
        post,
        postAuthor: author ? '@' + author.username : '',
        channelId: getCurrentChannelId(state) || '',
        teamName: getCurrentTeam(state)?.name || '',
        theme: getTheme(state),
    };
};

const actionCreators = {
    clearRHSCreate,
    createIssue,
    fetchJiraIssueMetadataForProjects,
    fetchJiraProjectMetadata,
    openRHSIssue,
};

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators(actionCreators, dispatch) as unknown as DispatchProps;

export default connect<ReturnType<typeof mapStateToProps>, DispatchProps, OwnProps, GlobalState>(mapStateToProps, mapDispatchToProps)(CreateSection);
