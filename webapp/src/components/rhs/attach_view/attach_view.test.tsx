// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {
    act,
    fireEvent,
    render,
    screen,
} from '@testing-library/react';

import {RHSIssue} from 'types/rhs';

import {RHS_STRINGS} from '../rhs_strings';

import AttachView, {Props, RHS_ATTACH_SEARCH_DEBOUNCE_MS} from './attach_view';

const issue = (key: string): RHSIssue => ({
    key,
    summary: 'Summary ' + key,
    browseUrl: '',
    status: {name: 'Open', categoryKey: 'new'},
    issueType: 'Task',
    project: 'TES',
    updated: '',
});

function makeProps(overrides: Partial<Props> = {}): Props {
    return {
        postId: 'p1',
        post: {id: 'p1', channel_id: 'c1', message: 'Экспорт CSV возвращает 403'} as Props['post'],
        postAuthor: '@anna',
        closeRHSAttach: jest.fn(),
        searchRHSAttachIssues: jest.fn(async (q: string) => ({data: {issues: q ? [issue('BACK-409')] : [issue('BACK-1'), issue('BACK-2')], total: q ? 1 : null, isLast: true}})),
        attachPostToIssue: jest.fn(async () => ({data: {}})),
        openRHSIssue: jest.fn(),
        ...overrides,
    };
}

async function flush() {
    await act(async () => {
        jest.advanceTimersByTime(RHS_ATTACH_SEARCH_DEBOUNCE_MS);
    });
}

describe('components/rhs/attach_view', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('shows the message and the user open issues first', async () => {
        const props = makeProps();
        render(<AttachView {...props}/>);
        await flush();
        expect(screen.getByTestId('rhs-attach-quote')).toHaveTextContent('Из сообщения @anna');
        expect(screen.getByTestId('rhs-attach-found')).toHaveTextContent(RHS_STRINGS.attachMine);
        expect(screen.getByTestId('rhs-attach-option-BACK-2')).toBeInTheDocument();
        expect(props.searchRHSAttachIssues).toHaveBeenCalledWith('');
        expect(screen.getByTestId('rhs-attach-submit')).toBeDisabled();
    });

    test('search, select and attach', async () => {
        const props = makeProps();
        render(<AttachView {...props}/>);
        await flush();

        fireEvent.change(screen.getByTestId('rhs-attach-search'), {target: {value: 'экспорт'}});
        await flush();
        expect(props.searchRHSAttachIssues).toHaveBeenLastCalledWith('экспорт');
        expect(screen.getByTestId('rhs-attach-found')).toHaveTextContent('Найдено 1');

        fireEvent.click(screen.getByTestId('rhs-attach-option-BACK-409'));
        expect(screen.getByTestId('rhs-attach-option-BACK-409')).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByTestId('rhs-attach-submit')).toHaveTextContent('Приложить к BACK-409');

        fireEvent.click(screen.getByTestId('rhs-attach-submit'));
        expect(await screen.findByTestId('rhs-attach-done')).toHaveTextContent('Сообщение приложено к BACK-409');
        expect(props.attachPostToIssue).toHaveBeenCalledWith('p1', 'BACK-409');

        fireEvent.click(screen.getByTestId('rhs-attach-open-card'));
        expect(props.openRHSIssue).toHaveBeenCalledWith('BACK-409');
    });

    test('a failed attach shows the server message and keeps the choice', async () => {
        const props = makeProps({attachPostToIssue: jest.fn(async () => ({error: {message: 'you do not have permission to create a comment'}}))});
        render(<AttachView {...props}/>);
        await flush();
        fireEvent.click(screen.getByTestId('rhs-attach-option-BACK-1'));
        fireEvent.click(screen.getByTestId('rhs-attach-submit'));
        expect(await screen.findByTestId('rhs-attach-error')).toHaveTextContent('permission');
        expect(screen.getByTestId('rhs-attach-option-BACK-1')).toHaveAttribute('aria-selected', 'true');
    });

    test('a JQL error from Jira is shown', async () => {
        const props = makeProps({searchRHSAttachIssues: jest.fn(async () => ({error: {errorCode: 'invalid_query', message: 'Ошибка в запросе JQL'}}))});
        render(<AttachView {...props}/>);
        await flush();
        expect(screen.getByTestId('rhs-state-query-error')).toHaveTextContent('Ошибка в запросе JQL');
    });

    test('a missing post blocks attaching', async () => {
        render(<AttachView {...makeProps({post: null})}/>);
        await flush();
        expect(screen.getByText(RHS_STRINGS.attachPostMissing)).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('rhs-attach-option-BACK-1'));
        expect(screen.getByTestId('rhs-attach-submit')).toBeDisabled();
    });

    test('back, cancel and Escape close the view', async () => {
        const props = makeProps();
        render(<AttachView {...props}/>);
        await flush();
        fireEvent.click(screen.getByTestId('rhs-attach-back'));
        fireEvent.click(screen.getByTestId('rhs-attach-cancel'));
        fireEvent.keyDown(screen.getByTestId('rhs-attach-search'), {key: 'Escape'});
        expect(props.closeRHSAttach).toHaveBeenCalledTimes(3);
    });
});
