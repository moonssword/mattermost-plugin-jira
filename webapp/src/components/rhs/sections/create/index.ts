// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/common';

import {openCreateModalWithoutPost} from 'actions';

import {GlobalState} from 'types/store';

import CreateSection from './create_section';

const mapStateToProps = (state: GlobalState) => ({
    channelId: getCurrentChannelId(state) || '',
});

export default connect(mapStateToProps, {openCreateModalWithoutPost})(CreateSection);
