// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {
    act,
    fireEvent,
    render,
    screen,
} from '@testing-library/react';

import {JiraField} from 'types/model';

import TransitionForm, {cleanScreenValues, splitScreenFields} from './transition_form';

jest.mock('../sections/create/panel_fields', () => ({
    __esModule: true,
    default: (props: {fields: object}) => <div data-testid='fields'>{Object.keys(props.fields).join(',')}</div>,
}));

const resolution = {name: 'Решение', required: true, schema: {type: 'resolution'}, allowedValues: [{id: '1', name: 'Готово'}]} as unknown as JiraField;
const worklog = {name: 'Запись о работе', required: false, schema: {type: 'array', items: 'worklog'}} as unknown as JiraField;
const custom = {name: 'Особое поле', required: true, schema: {type: 'any'}} as unknown as JiraField;
const epic = {name: 'Epic Link', required: false, schema: {type: 'any', custom: 'com.pyxis.greenhopper.jira:gh-epic-link'}} as unknown as JiraField;

function setup(fields: {[key: string]: JiraField}, extra = {}) {
    const onSubmit = jest.fn();
    const onCancel = jest.fn();
    render(
        <TransitionForm
            transition={{id: '41', name: 'Выполнено', to: {id: '3', name: 'Готово', categoryKey: 'done'}} as never}
            fields={fields}
            instanceID='i'
            projectKey='AUTOPS'
            browseUrl='https://jira/browse/AUTOPS-7'
            theme={{} as never}
            busy={false}
            error=''
            onSubmit={onSubmit}
            onCancel={onCancel}
            {...extra}
        />,
    );
    return {onSubmit, onCancel};
}

describe('splitScreenFields', () => {
    test('keeps what the panel can edit', () => {
        const {shown, hidden} = splitScreenFields({resolution, worklog, epic});
        expect(Object.keys(shown)).toEqual(['resolution']);
        expect(hidden.map((f) => f.name)).toEqual(['Запись о работе', 'Epic Link']);
    });
});

describe('cleanScreenValues', () => {
    test('drops the fields left empty', () => {
        expect(cleanScreenValues({
            a: null,
            b: '',
            c: [],
            d: {id: null},
            e: {id: '1'},
            f: [{id: '2'}],
            g: {name: 'ivan'},
            h: 0,
        })).toEqual({e: {id: '1'}, f: [{id: '2'}], g: {name: 'ivan'}, h: 0});
    });
});

describe('TransitionForm', () => {
    test('sends the comment along with the values', () => {
        const {onSubmit} = setup({resolution});
        expect(screen.getByText('Смена статуса: Готово')).toBeTruthy();
        fireEvent.change(screen.getByTestId('rhs-transition-comment'), {target: {value: ' закрываю '}});
        act(() => {
            fireEvent.click(screen.getByTestId('rhs-transition-submit'));
        });
        expect(onSubmit).toHaveBeenCalledWith({fields: {}, comment: 'закрываю'});
    });

    test('names optional fields only Jira can fill in', () => {
        setup({resolution, worklog});
        expect(screen.getByText(/Заполняются только в Jira: Запись о работе/)).toBeTruthy();
        expect((screen.getByTestId('rhs-transition-submit') as HTMLButtonElement).disabled).toBe(false);
    });

    test('a required field the panel cannot show blocks the form and links to Jira', () => {
        const {onSubmit} = setup({resolution, custom});
        expect(screen.getByTestId('rhs-transition-blocked').textContent).toContain('Особое поле');
        expect(screen.getByRole('link').getAttribute('href')).toBe('https://jira/browse/AUTOPS-7');
        expect((screen.getByTestId('rhs-transition-submit') as HTMLButtonElement).disabled).toBe(true);
        fireEvent.submit(screen.getByTestId('rhs-transition-form'));
        expect(onSubmit).not.toHaveBeenCalled();
    });

    test('shows the error from Jira', () => {
        setup({resolution}, {error: 'Jira не выполнила действие: нет прав'});
        expect(screen.getByTestId('rhs-transition-error').textContent).toContain('нет прав');
    });
});
