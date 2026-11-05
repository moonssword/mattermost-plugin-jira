// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {pluginStateKey} from 'types/store';

import {getRHSStyle, getUILanguage, getUILocale} from './index';

function state(locale: string, preferences: {[name: string]: string} = {}, defaultStyle = 'compact') {
    const myPreferences: {[key: string]: {value: string}} = {};
    Object.keys(preferences).forEach((name) => {
        myPreferences['pp_jira--' + name] = {value: preferences[name]};
    });
    return {
        entities: {
            users: {currentUserId: 'u', profiles: {u: {id: 'u', locale}}},
            preferences: {myPreferences},
        },
        [pluginStateKey]: {pluginSettings: {rhs_default_style: defaultStyle}},
    } as never;
}

describe('appearance selectors', () => {
    test('the language follows Mattermost until the user chooses', () => {
        expect(getUILanguage(state('ru'))).toBe('ru');
        expect(getUILanguage(state('en'))).toBe('en');
        expect(getUILanguage(state('de'))).toBe('en');
        expect(getUILanguage(state('ru', {language: 'en'}))).toBe('en');
        expect(getUILanguage(state('en', {language: 'ru'}))).toBe('ru');
        expect(getUILanguage(state('ru', {language: 'auto'}))).toBe('ru');
        expect(getUILocale(state('es'))).toBe('es');
    });

    test('the style follows the default until the user chooses', () => {
        expect(getRHSStyle(state('ru'))).toBe('compact');
        expect(getRHSStyle(state('ru', {}, 'cards'))).toBe('cards');
        expect(getRHSStyle(state('ru', {style: 'compact'}, 'cards'))).toBe('compact');
        expect(getRHSStyle(state('ru', {style: 'cards'}))).toBe('cards');
        expect(getRHSStyle(state('ru', {style: 'default'}, 'cards'))).toBe('cards');
    });
});
