// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';

import {defaultRHSCardState} from '../../../reducers/rhs_card';
import {RHSCardState, RHSIssueCard} from 'types/rhs_issue';

import {rhsInitials} from '../rhs_avatar';
import {RHS_STRINGS} from '../rhs_strings';

import {RHS_ASSIGNEE_SEARCH_DEBOUNCE_MS} from './assignee_field';
import IssueCard, {Props, cardErrorText} from './issue_card';

const me = {name: 'ivan', displayName: 'Иван Петров'};

const data: RHSIssueCard = {
    key: 'BACK-412',
    summary: 'Таймаут при выгрузке отчёта',
    browseUrl: 'http://jira.example.com/browse/BACK-412',
    status: {name: 'В работе', categoryKey: 'indeterminate'},
    issueType: 'Баг',
    project: 'BACK',
    projectName: 'Backend',
    updated: '2026-11-03T08:00:00Z',
    priority: 'Высокий',
    assignee: {name: 'dk', displayName: 'Дмитрий Козлов'},
    reporter: {name: 'as', displayName: 'Анна Смирнова'},
    labels: ['reports', 'perf'],
    description: 'Отчёты больше 50 МБ падают по таймауту.',
    transitions: [
        {id: '11', name: 'Открыть заново', to: {name: 'Открыта', categoryKey: 'new'}},
        {id: '31', name: 'Готово', to: {name: 'Готово', categoryKey: 'done'}},
    ],
    comments: [{id: 'c1', author: {displayName: 'Дмитрий Козлов'}, body: 'Фикс в ветке.', created: '2026-11-03T07:40:00Z'}],
    commentsTotal: 3,
    me,
};

function makeProps(card: Partial<RHSCardState> = {}, overrides: Partial<Props> = {}): Props {
    return {
        card: {...defaultRHSCardState, key: 'BACK-412', data, ...card},
        channelId: 'channel-1',
        closeRHSIssue: jest.fn(),
        fetchRHSIssueCard: jest.fn(async () => ({})),
        transitionRHSCard: jest.fn(async () => ({})),
        assignRHSCard: jest.fn(async () => ({})),
        commentRHSCard: jest.fn(async () => ({})),
        shareRHSCard: jest.fn(async () => ({data: {post_id: 'p'}})),
        searchRHSCardAssignees: jest.fn(async () => ({data: [{name: 'as', displayName: 'Анна Смирнова'}]})),
        ...overrides,
    };
}

describe('components/rhs/issue_card', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    test('initials and error texts', () => {
        expect(rhsInitials('Дмитрий Козлов')).toBe('ДК');
        expect(rhsInitials('admin')).toBe('AD');
        expect(rhsInitials('  ')).toBe('?');
        expect(cardErrorText('jira_rejected', 'Resolution is required.')).toBe(RHS_STRINGS.cardActionFailed + ': Resolution is required.');
        expect(cardErrorText('not_found', '')).toBe(RHS_STRINGS.cardNotFound);
    });

    test('shows the issue fields, description and comments', () => {
        render(<IssueCard {...makeProps()}/>);
        expect(screen.getByText('BACK-412')).toBeInTheDocument();
        expect(screen.getByText('Backend · Баг')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: data.summary})).toBeInTheDocument();
        expect(screen.getByTestId('rhs-card-assignee')).toHaveTextContent('Дмитрий Козлов');
        expect(screen.getByText('perf')).toBeInTheDocument();
        expect(screen.getByText(data.description)).toBeInTheDocument();
        expect(screen.getByText('Фикс в ветке.')).toBeInTheDocument();
        expect(screen.getByTestId('rhs-card-comments-older')).toHaveTextContent('Показаны последние 1 из 3');
        expect(screen.getByTestId('rhs-card-open-jira')).toHaveAttribute('href', data.browseUrl);
    });

    test('loading, not found and generic errors', () => {
        const {rerender} = render(<IssueCard {...makeProps({data: null, loading: true})}/>);
        expect(screen.getByTestId('rhs-state-loading')).toBeInTheDocument();

        rerender(<IssueCard {...makeProps({data: null, error: 'not_found'})}/>);
        expect(screen.getByTestId('rhs-card-error')).toHaveTextContent(RHS_STRINGS.cardNotFound);

        const props = makeProps({data: null, error: 'internal_error'});
        rerender(<IssueCard {...props}/>);
        fireEvent.click(screen.getByText(RHS_STRINGS.retry));
        expect(props.fetchRHSIssueCard).toHaveBeenCalledWith('BACK-412');
    });

    test('status menu lists transitions and runs the chosen one', () => {
        const props = makeProps();
        render(<IssueCard {...props}/>);
        fireEvent.click(screen.getByTestId('rhs-card-status'));
        expect(screen.getByTestId('rhs-card-transitions')).toHaveTextContent('Открыта');
        fireEvent.click(screen.getByTestId('rhs-card-transition-31'));
        expect(props.transitionRHSCard).toHaveBeenCalledWith('31');
        expect(screen.queryByTestId('rhs-card-transitions')).toBeNull();
    });

    test('assign to me is hidden when the issue is already mine', () => {
        const props = makeProps();
        const {rerender} = render(<IssueCard {...props}/>);
        fireEvent.click(screen.getByTestId('rhs-card-assign-me'));
        expect(props.assignRHSCard).toHaveBeenCalledWith({me: true});

        rerender(<IssueCard {...makeProps({data: {...data, assignee: {name: 'ivan', displayName: 'Иван Петров'}}})}/>);
        expect(screen.queryByTestId('rhs-card-assign-me')).toBeNull();
    });

    test('assignee picker searches after a pause and assigns or unassigns', async () => {
        jest.useFakeTimers();
        const props = makeProps();
        render(<IssueCard {...props}/>);
        fireEvent.click(screen.getByTestId('rhs-card-assignee-edit'));
        expect(screen.getByText(RHS_STRINGS.assigneeTypeHint)).toBeInTheDocument();

        fireEvent.change(screen.getByTestId('rhs-card-assignee-search'), {target: {value: 'ан'}});
        await act(async () => {
            jest.advanceTimersByTime(RHS_ASSIGNEE_SEARCH_DEBOUNCE_MS);
        });
        expect(props.searchRHSCardAssignees).toHaveBeenCalledWith('ан');
        fireEvent.click(await screen.findByTestId('rhs-card-assignee-option-as'));
        expect(props.assignRHSCard).toHaveBeenCalledWith({user: {name: 'as', displayName: 'Анна Смирнова'}});

        fireEvent.click(screen.getByTestId('rhs-card-assignee-edit'));
        fireEvent.click(screen.getByTestId('rhs-card-unassign'));
        expect(props.assignRHSCard).toHaveBeenLastCalledWith({nobody: true});
    });

    test('comment is sent with Ctrl+Enter and cleared on success', async () => {
        const props = makeProps();
        render(<IssueCard {...props}/>);
        const input = screen.getByTestId('rhs-card-comment-input');
        fireEvent.change(input, {target: {value: '  Проверил  '}});
        fireEvent.keyDown(input, {key: 'Enter', ctrlKey: true});
        await waitFor(() => expect(input).toHaveValue(''));
        expect(props.commentRHSCard).toHaveBeenCalledWith('Проверил');
    });

    test('a failed comment keeps the text', async () => {
        const props = makeProps({}, {commentRHSCard: jest.fn(async () => ({error: new Error('x')}))});
        render(<IssueCard {...props}/>);
        const input = screen.getByTestId('rhs-card-comment-input');
        fireEvent.change(input, {target: {value: 'Текст'}});
        fireEvent.click(screen.getByTestId('rhs-card-comment-send'));
        await waitFor(() => expect(props.commentRHSCard).toHaveBeenCalled());
        expect(input).toHaveValue('Текст');
    });

    test('share posts to the current channel and confirms', async () => {
        const props = makeProps();
        render(<IssueCard {...props}/>);
        fireEvent.click(screen.getByTestId('rhs-card-share'));
        expect(props.shareRHSCard).toHaveBeenCalledWith('channel-1');
        expect(await screen.findByText(RHS_STRINGS.shared)).toBeInTheDocument();
    });

    test('action errors are shown and buttons are disabled while busy', () => {
        render(<IssueCard {...makeProps({pending: 'comment', actionError: 'jira_rejected', actionErrorMessage: 'Нет прав'})}/>);
        expect(screen.getByTestId('rhs-card-action-error')).toHaveTextContent('Нет прав');
        expect(screen.getByTestId('rhs-card-share')).toBeDisabled();
    });

    test('back and Escape close the card', () => {
        const props = makeProps();
        render(<IssueCard {...props}/>);
        expect(screen.getByTestId('rhs-card-back')).toHaveFocus();
        fireEvent.click(screen.getByTestId('rhs-card-back'));
        fireEvent.keyDown(screen.getByTestId('rhs-card'), {key: 'Escape'});
        expect(props.closeRHSIssue).toHaveBeenCalledTimes(2);
    });
});
