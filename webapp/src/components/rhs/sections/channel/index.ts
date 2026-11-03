// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/common';

import {openChannelSettings} from 'actions';

import {GlobalState} from 'types/store';

import ChannelSection from './channel_section';

const mapStateToProps = (state: GlobalState) => ({
    channelId: getCurrentChannelId(state) || '',
});

export default connect(mapStateToProps, {openChannelSettings})(ChannelSection);
