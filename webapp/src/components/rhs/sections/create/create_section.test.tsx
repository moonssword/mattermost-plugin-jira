// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';

import {IssueMetadata, JiraField} from 'types/model';

import {RHS_STRINGS} from '../../rhs_strings';

import CreateSection, {Props, panelFieldDefs, unsupportedRequiredFields} from './create_section';

jest.mock('components/react_select_setting', () => (props: any) => (
    <label>
        {props.label}
        <select
            data-testid={'select-' + props.name}
            value={props.value ? props.value.value : ''}
            onChange={(e) => props.onChange(props.name, e.target.value)}
        >
            <option value=''>{'-'}</option>
            {props.options.map((o: any) => (
                <option
                    key={o.value}
                    value={o.value}
                >
                    {o.label}
                </option>
            ))}
        </select>
    </label>
));

jest.mock('components/jira_fields', () => (props: any) => (
    <div data-testid='jira-fields'>
        <input
            data-testid='field-summary'
            value={props.values.summary || ''}
            onChange={(e) => props.onChange('summary', e.target.value)}
        />
        <span data-testid='field-description'>{props.values.description}</span>
        <span data-testid='field-keys'>{Object.keys(props.fields).join(',')}</span>
    </div>
));

const textField = (name: string, required = false, extra: Partial<JiraField> = {}) => ({
    name,
    key: name,
    required,
    schema: {type: 'string', system: name},
    ...extra,
}) as unknown as JiraField;

const metadata = {
    projects: [{
        key: 'BACK',
        issuetypes: [
            {id: '1', name: 'Баг', subtask: false, fields: {summary: textField('summary', true), description: textField('description'), reporter: textField('reporter', true)}},
            {id: '2', name: 'Задача', subtask: false, fields: {summary: textField('summary', true)}},
        ],
    }],
} as unknown as IssueMetadata;

function makeProps(overrides: Partial<Props> = {}): Props {
    return {
        instanceID: 'http://jira.example.com',
        channelId: 'channel-1',
        teamName: 'team',
        theme: {} as Props['theme'],
        prefill: {postId: '', summary: '', description: '', nonce: 0},
        post: null,
        postAuthor: '',
        fetchJiraProjectMetadata: jest.fn(async () => ({data: {projects: [{label: 'Backend', value: 'BACK'}], issues_per_project: {}, saved_field_values: {project_key: 'BACK', issue_type: '1'}}})),
        fetchJiraIssueMetadataForProjects: jest.fn(async () => ({data: metadata})),
        createIssue: jest.fn(async () => ({data: {key: 'BACK-500'}})),
        openRHSIssue: jest.fn(),
        clearRHSCreate: jest.fn(),
        openCreateModal: jest.fn(),
        openCreateModalWithoutPost: jest.fn(),
        ...overrides,
    };
}

describe('components/rhs/sections/create', () => {
    test('panelFieldDefs relaxes only the required reporter', () => {
        const defs = panelFieldDefs({reporter: textField('reporter', true), summary: textField('summary', true)});
        expect(defs.reporter.required).toBe(false);
        expect(defs.summary.required).toBe(true);
    });

    test('unsupportedRequiredFields lists required fields the panel cannot render', () => {
        const odd = textField('weird', true, {schema: {type: 'sd-feedback', custom: 'x'}} as unknown as Partial<JiraField>);
        expect(unsupportedRequiredFields({summary: textField('summary', true), weird: odd})).toEqual([['weird', 'weird']]);
    });

    test('preselects the saved project and type and prefills from the message', async () => {
        const props = makeProps({
            prefill: {postId: 'p1', summary: 'Экспорт падает', description: 'Экспорт падает\nдетали', nonce: 1},
            post: {id: 'p1', channel_id: 'dm', message: 'Экспорт падает\nдетали'} as Props['post'],
            postAuthor: '@anna',
        });
        render(<CreateSection {...props}/>);

        expect(await screen.findByTestId('jira-fields')).toBeInTheDocument();
        expect(screen.getByTestId('rhs-create-quote')).toHaveTextContent('Из сообщения @anna');
        expect(screen.getByTestId('select-project')).toHaveValue('BACK');
        expect(screen.getByTestId('select-issue_type')).toHaveValue('1');
        expect(screen.getByTestId('field-summary')).toHaveValue('Экспорт падает');
        expect(screen.getByTestId('field-description')).toHaveTextContent('детали');
        expect(screen.getByText(RHS_STRINGS.createReplyInThread)).toBeInTheDocument();
        expect(props.fetchJiraIssueMetadataForProjects).toHaveBeenCalledWith(['BACK'], 'http://jira.example.com');
    });

    test('creates the issue from a message and offers the card', async () => {
        const props = makeProps({
            prefill: {postId: 'p1', summary: 'S', description: 'D', nonce: 1},
            post: {id: 'p1', channel_id: 'dm', message: 'S'} as Props['post'],
        });
        render(<CreateSection {...props}/>);
        await screen.findByTestId('jira-fields');

        fireEvent.click(screen.getByTestId('rhs-create-reply'));
        fireEvent.click(screen.getByTestId('rhs-create-submit'));

        expect(await screen.findByTestId('rhs-create-done')).toHaveTextContent('Задача BACK-500 создана');
        expect(props.createIssue).toHaveBeenCalledWith(expect.objectContaining({
            instance_id: 'http://jira.example.com',
            post_id: 'p1',
            channel_id: 'dm',
            current_team: 'team',
            skip_public_reply: true,
            fields: expect.objectContaining({summary: 'S', description: 'D', project: {key: 'BACK'}, issuetype: {id: '1'}}),
        }));
        expect(props.clearRHSCreate).toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('rhs-create-open-card'));
        expect(props.openRHSIssue).toHaveBeenCalledWith('BACK-500');
    });

    test('without a message the issue goes to the current channel', async () => {
        const props = makeProps();
        render(<CreateSection {...props}/>);
        await screen.findByTestId('jira-fields');
        expect(screen.queryByTestId('rhs-create-quote')).toBeNull();
        expect(screen.getByText(RHS_STRINGS.createPostToChannel)).toBeInTheDocument();
        fireEvent.change(screen.getByTestId('field-summary'), {target: {value: 'Новая'}});
        fireEvent.click(screen.getByTestId('rhs-create-submit'));
        await screen.findByTestId('rhs-create-done');
        expect(props.createIssue).toHaveBeenCalledWith(expect.objectContaining({post_id: '', channel_id: 'channel-1', skip_public_reply: false}));
    });

    test('changing the issue type keeps summary and description', async () => {
        const props = makeProps({prefill: {postId: '', summary: 'S', description: 'D', nonce: 1}});
        render(<CreateSection {...props}/>);
        await screen.findByTestId('jira-fields');
        fireEvent.change(screen.getByTestId('select-issue_type'), {target: {value: '2'}});
        expect(screen.getByTestId('field-summary')).toHaveValue('S');
        expect(screen.getByTestId('field-keys')).toHaveTextContent('summary');
    });

    test('a server error is shown and the form stays', async () => {
        const props = makeProps({createIssue: jest.fn(async () => ({error: new Error('Поле «Компонент» обязательно')}))});
        render(<CreateSection {...props}/>);
        await screen.findByTestId('jira-fields');
        fireEvent.click(screen.getByTestId('rhs-create-submit'));
        expect(await screen.findByTestId('rhs-create-error')).toHaveTextContent('Поле «Компонент» обязательно');
        expect(screen.getByTestId('rhs-create-form')).toBeInTheDocument();
    });

    test('a new prefill replaces the text', async () => {
        const props = makeProps({prefill: {postId: '', summary: 'A', description: 'A', nonce: 1}});
        const {rerender} = render(<CreateSection {...props}/>);
        await screen.findByTestId('jira-fields');
        rerender(
            <CreateSection
                {...props}
                prefill={{postId: '', summary: 'B', description: 'B', nonce: 2}}
            />,
        );
        await waitFor(() => expect(screen.getByTestId('field-summary')).toHaveValue('B'));
    });

    test('the form can move to the modal with the same message', async () => {
        const props = makeProps({
            prefill: {postId: 'p1', summary: 'S', description: 'D', nonce: 1},
            post: {id: 'p1', channel_id: 'dm', message: 'S'} as Props['post'],
        });
        render(<CreateSection {...props}/>);
        await screen.findByTestId('jira-fields');
        fireEvent.click(screen.getByTestId('rhs-create-in-modal'));
        expect(props.openCreateModal).toHaveBeenCalledWith('p1');
        expect(props.clearRHSCreate).toHaveBeenCalled();
    });

    test('without a message the modal gets the typed description', async () => {
        const props = makeProps({prefill: {postId: '', summary: '', description: 'Текст', nonce: 1}});
        render(<CreateSection {...props}/>);
        await screen.findByTestId('jira-fields');
        fireEvent.click(screen.getByTestId('rhs-create-in-modal'));
        expect(props.openCreateModalWithoutPost).toHaveBeenCalledWith('Текст', 'channel-1');
    });

    test('no projects shows a hint', async () => {
        render(<CreateSection {...makeProps({fetchJiraProjectMetadata: jest.fn(async () => ({data: {projects: [], issues_per_project: {}}}))})}/>);
        expect(await screen.findByText(RHS_STRINGS.createNoProjects)).toBeInTheDocument();
    });
});
