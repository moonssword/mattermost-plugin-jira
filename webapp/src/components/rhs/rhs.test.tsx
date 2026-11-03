// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';

import {Instance, InstanceType} from 'types/model';

import Rhs, {Props, rhsScreen} from './rhs';
import {RHS_STRINGS} from './rhs_strings';

jest.mock('./rhs_sections', () => {
    const section = (id: string) => (props: {instanceID: string}) => (
        <div data-testid={'stub-' + id}>{props.instanceID}</div>
    );
    const sections = [
        {id: 'my_issues', title: 'Мои задачи', component: section('my_issues')},
        {id: 'channel', title: 'Канал', component: section('channel')},
        {id: 'create', title: 'Создать', component: section('create')},
    ];
    return {
        RHS_SECTIONS: sections,
        findRHSSection: (id: string) => sections.find((s) => s.id === id) || sections[0],
    };
});

const cloudOne: Instance = {instance_id: 'https://one.atlassian.net', type: InstanceType.CLOUD};
const serverOne: Instance = {instance_id: 'http://jira.example.com', type: InstanceType.SERVER};

function makeProps(overrides: Partial<Props> = {}): Props {
    return {
        installedInstances: [serverOne],
        connectedInstances: [serverOne],
        activeInstanceID: serverOne.instance_id,
        section: 'my_issues',
        issueKey: '',
        attachPostId: '',
        settingsOpen: false,
        issuesError: null,
        isAdmin: false,
        channelId: 'channel-1',
        teamId: 'team-1',
        getConnected: jest.fn(async () => ({})),
        restoreRHSViewState: jest.fn(() => ({data: null})),
        setRHSSection: jest.fn(),
        selectRHSInstance: jest.fn(),
        openRHSSettings: jest.fn(),
        handleConnectFlow: jest.fn(),
        startJiraSetupWizard: jest.fn(async () => ({data: {}})),
        ...overrides,
    };
}

async function renderSettled(overrides: Partial<Props> = {}) {
    const props = makeProps(overrides);
    const view = render(<Rhs {...props}/>);
    await waitFor(() => {
        expect(screen.queryByTestId('rhs-state-loading')).toBeNull();
    });
    return {props, ...view};
}

describe('components/rhs', () => {
    test('rhsScreen picks the first-run screens before the main panel', () => {
        const base = {booting: false, installedCount: 1, connectedCount: 1, issuesError: null};
        expect(rhsScreen({...base, booting: true})).toBe('loading');
        expect(rhsScreen({...base, installedCount: 0, connectedCount: 0})).toBe('no_instance');
        expect(rhsScreen({...base, connectedCount: 0})).toBe('connect');
        expect(rhsScreen({...base, issuesError: 'not_connected'})).toBe('connect');
        expect(rhsScreen(base)).toBe('main');
    });

    test('booting shows loading until getConnected resolves', () => {
        render(
            <Rhs
                {...makeProps({
                    getConnected: jest.fn(() => new Promise(() => {
                        // never resolves
                    })),
                })}
            />,
        );
        expect(screen.getByTestId('rhs-state-loading')).toBeInTheDocument();
    });

    test('boot runs getConnected before restoreRHSViewState', async () => {
        const order: string[] = [];
        await renderSettled({
            getConnected: jest.fn(async () => {
                order.push('connected');
                return {};
            }),
            restoreRHSViewState: jest.fn(() => {
                order.push('restore');
                return {data: null};
            }),
        });
        expect(order).toEqual(['connected', 'restore']);
    });

    test('main panel shows the instance, section tabs and the active section', async () => {
        await renderSettled();
        expect(screen.getByTestId('rhs-instance-name')).toHaveTextContent('jira.example.com');
        expect(screen.getByTestId('rhs-instance-name')).toHaveTextContent(RHS_STRINGS.instanceServer);
        expect(screen.getByRole('tab', {name: 'Мои задачи'})).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByTestId('stub-my_issues')).toHaveTextContent(serverOne.instance_id);
    });

    test('the gear opens the settings', async () => {
        const {props} = await renderSettled();
        fireEvent.click(screen.getByTestId('rhs-open-settings'));
        expect(props.openRHSSettings).toHaveBeenCalled();
    });

    test('clicking a section tab selects it', async () => {
        const {props} = await renderSettled();
        fireEvent.click(screen.getByRole('tab', {name: 'Канал'}));
        expect(props.setRHSSection).toHaveBeenCalledWith('channel');
    });

    test('the selected section from the store is rendered', async () => {
        await renderSettled({section: 'create'});
        expect(screen.getByTestId('stub-create')).toBeInTheDocument();
        expect(screen.getByRole('tab', {name: 'Создать'})).toHaveAttribute('aria-selected', 'true');
    });

    test('arrow keys move between section tabs', async () => {
        const {props} = await renderSettled();
        fireEvent.keyDown(screen.getByRole('tab', {name: 'Мои задачи'}), {key: 'ArrowLeft'});
        expect(props.setRHSSection).toHaveBeenCalledWith('create');
    });

    test('instance picker appears with two connected instances', async () => {
        const {props} = await renderSettled({
            installedInstances: [cloudOne, serverOne],
            connectedInstances: [cloudOne, serverOne],
            activeInstanceID: cloudOne.instance_id,
        });
        const picker = screen.getByTestId('rhs-instance-picker');
        expect(picker).toHaveTextContent('one.atlassian.net (Cloud)');
        fireEvent.change(picker, {target: {value: serverOne.instance_id}});
        expect(props.selectRHSInstance).toHaveBeenCalledWith(serverOne.instance_id);
    });

    test('not connected users see the connect screen without an instance list', async () => {
        const {props} = await renderSettled({connectedInstances: []});
        expect(screen.getByTestId('rhs-state-not-connected')).toBeInTheDocument();
        expect(screen.getByText(RHS_STRINGS.connectTitle)).toBeInTheDocument();
        expect(screen.queryByTestId('rhs-connect-instance')).toBeNull();
        expect(screen.queryByTestId('rhs-section-tabs')).toBeNull();
        fireEvent.click(screen.getByTestId('rhs-connect'));
        expect(props.handleConnectFlow).toHaveBeenCalledWith(serverOne.instance_id);
        expect(screen.getByText(RHS_STRINGS.connectWaiting)).toBeInTheDocument();
    });

    test('connect screen lets the user pick among several instances', async () => {
        const {props} = await renderSettled({
            installedInstances: [cloudOne, serverOne],
            connectedInstances: [],
        });
        fireEvent.change(screen.getByTestId('rhs-connect-instance'), {target: {value: serverOne.instance_id}});
        fireEvent.click(screen.getByTestId('rhs-connect'));
        expect(props.handleConnectFlow).toHaveBeenCalledWith(serverOne.instance_id);
    });

    test('a rejected connection shows the connect screen', async () => {
        await renderSettled({issuesError: 'not_connected'});
        expect(screen.getByTestId('rhs-state-not-connected')).toBeInTheDocument();
    });

    test('without instances a regular user is told to ask an admin', async () => {
        await renderSettled({installedInstances: [], connectedInstances: []});
        expect(screen.getByTestId('rhs-state-no-instance')).toBeInTheDocument();
        expect(screen.getByText(RHS_STRINGS.noInstanceUser)).toBeInTheDocument();
        expect(screen.queryByTestId('rhs-run-setup')).toBeNull();
    });

    test('without instances an admin can start the setup wizard', async () => {
        const {props} = await renderSettled({installedInstances: [], connectedInstances: [], isAdmin: true});
        fireEvent.click(screen.getByTestId('rhs-run-setup'));
        await waitFor(() => {
            expect(screen.getByText(RHS_STRINGS.setupStarted)).toBeInTheDocument();
        });
        expect(props.startJiraSetupWizard).toHaveBeenCalledWith('channel-1', 'team-1');
    });

    test('a failed setup start tells the admin to run the command', async () => {
        await renderSettled({
            installedInstances: [],
            connectedInstances: [],
            isAdmin: true,
            startJiraSetupWizard: jest.fn(async () => ({error: new Error('boom')})),
        });
        fireEvent.click(screen.getByTestId('rhs-run-setup'));
        await waitFor(() => {
            expect(screen.getByText(RHS_STRINGS.setupFailed)).toBeInTheDocument();
        });
    });
});
