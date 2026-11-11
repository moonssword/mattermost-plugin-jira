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

import Rhs, {Props, RHS_FOCUS_DELAY_MS, rhsScreen} from './rhs';
import {RHS_STRINGS} from './rhs_strings';

jest.mock('./rhs_sections', () => {
    const section = (id: string) => (props: {instanceID: string; onBack?: () => void}) => (
        <div data-testid={'stub-' + id}>
            {props.instanceID}
            {props.onBack && (
                <button
                    data-testid={'stub-back-' + id}
                    onClick={props.onBack}
                />
            )}
        </div>
    );
    const sections = [
        {id: 'my_issues', title: 'Мои задачи', component: section('my_issues')},
        {id: 'channel', title: 'Канал', component: section('channel')},
        {id: 'create', title: 'Создать', component: section('create'), tab: false},
    ];
    return {
        RHS_SECTIONS: sections,
        RHS_TAB_SECTIONS: sections.filter((s) => s.tab !== false),
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
        myIssuesCount: null,
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

    test('the create form takes the whole panel, without tabs, and goes back', async () => {
        const {props} = await renderSettled({section: 'create'});
        expect(screen.getByTestId('stub-create')).toBeInTheDocument();
        expect(screen.queryByTestId('rhs-section-tabs')).toBeNull();
        expect(screen.queryByTestId('rhs-quick-create')).toBeNull();
        fireEvent.click(screen.getByTestId('stub-back-create'));
        expect(props.setRHSSection).toHaveBeenCalledWith('my_issues');
    });

    test('arrow keys move between section tabs', async () => {
        const {props} = await renderSettled();
        fireEvent.keyDown(screen.getByRole('tab', {name: 'Мои задачи'}), {key: 'ArrowLeft'});
        expect(props.setRHSSection).toHaveBeenCalledWith('channel');
    });

    test('the bottom bar and the C key open the create form', async () => {
        const {props} = await renderSettled({myIssuesCount: 12});
        expect(screen.getByTestId('rhs-section-count-my_issues')).toHaveTextContent('12');
        fireEvent.click(screen.getByTestId('rhs-quick-create'));
        expect(props.setRHSSection).toHaveBeenCalledWith('create');

        (props.setRHSSection as jest.Mock).mockClear();
        fireEvent.keyDown(screen.getByTestId('stub-my_issues'), {key: 'с'});
        expect(props.setRHSSection).toHaveBeenCalledWith('create');
    });

    test('the panel takes the focus when it opens and keeps it on a click anywhere', async () => {
        await renderSettled();
        const panel = screen.getByTestId('jira-rhs');
        expect(panel).toHaveAttribute('tabindex', '-1');
        await waitFor(() => expect(document.activeElement).toBe(panel));
    });

    test('the panel takes back a focus lost when a view closes', async () => {
        const {props, rerender} = await renderSettled();
        (document.activeElement as HTMLElement | null)?.blur();
        expect(document.activeElement).toBe(document.body);
        rerender(
            <Rhs
                {...props}
                section='channel'
            />,
        );
        await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('jira-rhs')));
    });

    test('C works in any keyboard layout', async () => {
        const {props} = await renderSettled();
        fireEvent.keyDown(screen.getByTestId('stub-my_issues'), {key: 'ы', code: 'KeyC'});
        expect(props.setRHSSection).toHaveBeenCalledWith('create');
    });

    test('opening the panel does not take the focus from a field being typed in', async () => {
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();
        await renderSettled();
        await new Promise((resolve) => setTimeout(resolve, RHS_FOCUS_DELAY_MS + 50));
        expect(document.activeElement).toBe(input);
        input.remove();
    });

    test('typing in a field does not trigger shortcuts', async () => {
        const {props} = await renderSettled();
        const input = document.createElement('input');
        screen.getByTestId('stub-my_issues').appendChild(input);
        fireEvent.keyDown(input, {key: 'c'});
        expect(props.setRHSSection).not.toHaveBeenCalled();
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
