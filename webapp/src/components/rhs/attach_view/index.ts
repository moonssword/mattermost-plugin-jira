// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {Dispatch, bindActionCreators} from 'redux';

import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {
    attachPostToIssue,
    closeRHSAttach,
    openRHSIssue,
    searchRHSAttachIssues,
} from 'actions';
import {getRHSAttachPostId} from 'selectors';

import {GlobalState} from 'types/store';

import AttachView, {Props} from './attach_view';

type DispatchProps = Pick<Props, 'attachPostToIssue' | 'closeRHSAttach' | 'openRHSIssue' | 'searchRHSAttachIssues'>;

const mapStateToProps = (state: GlobalState) => {
    const postId = getRHSAttachPostId(state);
    const post = postId ? getPost(state, postId) || null : null;
    const author = post ? getUser(state, post.user_id) : null;
    return {
        postId,
        post,
        postAuthor: author ? '@' + author.username : '',
    };
};

const actionCreators = {
    attachPostToIssue,
    closeRHSAttach,
    openRHSIssue,
    searchRHSAttachIssues,
};

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators(actionCreators, dispatch) as unknown as DispatchProps;

export default connect(mapStateToProps, mapDispatchToProps)(AttachView);
