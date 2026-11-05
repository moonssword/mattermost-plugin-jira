// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {GlobalState} from 'types/store';

import {canUserConnect, getUILocale, isUserConnected} from 'selectors';

import CreateIssuePostMenuAction from './create_issue';

function mapStateToProps(state: GlobalState): {actionText: string} {
    const locale = getUILocale(state);
    const userConnected: boolean = isUserConnected(state);
    const userCanConnect: boolean = canUserConnect(state);

    let actionText;
    if (userConnected) {
        switch (locale) {
        case 'es':
            actionText = 'Crear incidencia en Jira';
            break;
        case 'ru':
            actionText = 'Создать задачу Jira';
            break;
        default:
            actionText = 'Create Jira Issue';
        }
    } else if (userCanConnect) {
        actionText = locale === 'ru' ? 'Подключить Jira' : 'Connect to Jira';
    } else {
        actionText = '';
    }

    return {
        actionText,
    };
}

export default connect(mapStateToProps)(CreateIssuePostMenuAction);