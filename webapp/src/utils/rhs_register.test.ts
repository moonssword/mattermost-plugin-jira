// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Rhs from 'components/rhs';

import {Instance} from 'types/model';
import {GlobalState, pluginStateKey} from 'types/store';

import ActionTypes from '../action_types';

import {getRHSPluginActions, resetRHSPluginActions} from './rhs_controller';
import {
    JIRA_RHS_TITLE,
    getJiraAppBarIconUrl,
    registerJiraRHS,
    shouldRegisterJiraRHS,
} from './rhs_register';

const settingsRhsOff = {
    ui_enabled: false,
    rhs_enabled: false,
    security_level_empty_for_jira_subscriptions: true,
};
const settingsRhsOn = {
    ...settingsRhsOff,
    rhs_enabled: true,
};

function makeState(plugin: {installedInstances?: Instance[]}): GlobalState {
    return {
        entities: {
            general: {config: {SiteURL: 'http://localhost:8065'}},
        },
        [pluginStateKey]: plugin,
    } as unknown as GlobalState;
}

describe('rhs_register', () => {
    afterEach(() => {
        resetRHSPluginActions();
    });

    test('shouldRegisterJiraRHS follows the rhs_enabled setting only', () => {
        expect(shouldRegisterJiraRHS(settingsRhsOn)).toBe(true);
        expect(shouldRegisterJiraRHS(settingsRhsOff)).toBe(false);
    });

    test('shouldRegisterJiraRHS is false for missing or error settings', () => {
        expect(shouldRegisterJiraRHS(null)).toBe(false);
        expect(shouldRegisterJiraRHS({error: true})).toBe(false);
    });

    test('getJiraAppBarIconUrl uses the plugin public path', () => {
        const url = getJiraAppBarIconUrl(makeState({}));
        expect(url).toContain('/plugins/jira/public/icon.svg');
        expect(url).not.toContain('/api/v2');
    });

    function makeRegistry(appBarResult: unknown) {
        return {
            registerAppBarComponent: jest.fn(() => appBarResult),
            registerChannelHeaderButtonAction: jest.fn(),
            registerChannelHeaderMenuAction: jest.fn(),
        };
    }

    function makeStore() {
        const dispatched: unknown[] = [];
        const store = {
            getState: () => makeState({}),
            dispatch: jest.fn((action: unknown): unknown => {
                if (typeof action === 'function') {
                    return action(store.dispatch, store.getState);
                }
                dispatched.push(action);
                return action;
            }),
        };
        return {store, dispatched};
    }

    const showAction = {type: 'SHOW_RHS_PLUGIN'};
    const toggleAction = {type: 'TOGGLE_RHS_PLUGIN'};
    const hostResult = {id: 'app-bar', rhsComponent: {id: 'rhs', showRHSPlugin: showAction, hideRHSPlugin: {}, toggleRHSPlugin: toggleAction}};

    test('registerJiraRHS registers the App Bar icon with the Rhs component', () => {
        const registry = makeRegistry(hostResult);
        registerJiraRHS(registry, makeStore().store);

        expect(registry.registerAppBarComponent).toHaveBeenCalledTimes(1);
        const args = registry.registerAppBarComponent.mock.calls[0] as unknown[];
        expect(args[1]).toBeUndefined();
        expect(args[2]).toBe(JIRA_RHS_TITLE);
        expect(args[4]).toBe(Rhs);
        expect(args[5]).toBe(JIRA_RHS_TITLE);
        expect(getRHSPluginActions()).toBe(hostResult.rhsComponent);
    });

    test('channel header button toggles and channel menu item opens the panel', () => {
        const registry = makeRegistry(hostResult);
        const {store, dispatched} = makeStore();
        registerJiraRHS(registry, store);

        const buttonAction = registry.registerChannelHeaderButtonAction.mock.calls[0][1] as () => void;
        buttonAction();
        expect(dispatched).toContainEqual(toggleAction);

        const menuAction = registry.registerChannelHeaderMenuAction.mock.calls[0][1] as () => void;
        menuAction();
        expect(dispatched).toContainEqual(showAction);
    });

    test('opening from the channel menu keeps the current section', () => {
        const registry = makeRegistry(hostResult);
        const {store, dispatched} = makeStore();
        registerJiraRHS(registry, store);

        (registry.registerChannelHeaderMenuAction.mock.calls[0][1] as () => void)();
        expect(dispatched.some((a) => (a as {type: string}).type === ActionTypes.SET_RHS_SECTION)).toBe(false);
    });

    test('an older server that returns only an id still registers the App Bar icon', () => {
        const registry = makeRegistry('app-bar-id');
        const {store, dispatched} = makeStore();
        registerJiraRHS(registry, store);

        expect(getRHSPluginActions()).toBeNull();
        (registry.registerChannelHeaderMenuAction.mock.calls[0][1] as () => void)();
        expect(dispatched).toEqual([]);
    });
});
