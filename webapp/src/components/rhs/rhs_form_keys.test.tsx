// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

import {preventImplicitSubmit} from './rhs_form_keys';

describe('preventImplicitSubmit', () => {
    const renderForm = () => {
        const onSubmit = jest.fn((event: React.FormEvent) => event.preventDefault());
        render(
            <form
                onSubmit={onSubmit}
                onKeyDown={preventImplicitSubmit}
            >
                <input
                    aria-label='labels'
                    role='combobox'
                />
                <textarea aria-label='description'/>
                <button type='submit'>{'Create'}</button>
            </form>,
        );
        return onSubmit;
    };

    test('a plain Enter in a field does not send the form', () => {
        renderForm();
        const input = screen.getByLabelText('labels');
        expect(fireEvent.keyDown(input, {key: 'Enter'})).toBe(false);
    });

    test('modified Enter, text areas and buttons keep their default', () => {
        renderForm();
        expect(fireEvent.keyDown(screen.getByLabelText('labels'), {key: 'Enter', ctrlKey: true})).toBe(true);
        expect(fireEvent.keyDown(screen.getByLabelText('description'), {key: 'Enter'})).toBe(true);
        expect(fireEvent.keyDown(screen.getByText('Create'), {key: 'Enter'})).toBe(true);
        expect(fireEvent.keyDown(screen.getByLabelText('labels'), {key: 'a'})).toBe(true);
    });
});
