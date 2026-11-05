// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {readFileSync, readdirSync, statSync} from 'fs';
import {join} from 'path';

import {RHS_STRINGS} from 'components/rhs/rhs_strings';

import {
    plural,
    setUILanguage,
    tr,
    uiLanguageForLocale,
} from './i18n';
import {TR_EN} from './i18n_en';
import {formatRHSRelativeTime, formatRHSShortDate} from './rhs_time';

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
            return sourceFiles(path);
        }
        return (/\.(ts|tsx|jsx)$/).test(name) && !name.includes('.test.') ? [path] : [];
    });
}

describe('i18n', () => {
    afterEach(() => setUILanguage('ru'));

    test('the language of a locale', () => {
        expect(uiLanguageForLocale('ru')).toBe('ru');
        expect(uiLanguageForLocale('en')).toBe('en');
        expect(uiLanguageForLocale('de')).toBe('en');
    });

    test('tr translates and fills placeholders', () => {
        expect(tr('Отмена')).toBe('Отмена');
        expect(tr('Проект {project} недоступен. Обратитесь к системному администратору.', {project: 'KT'})).toContain('Проект KT');
        setUILanguage('en');
        expect(tr('Отмена')).toBe('Cancel');
        expect(tr('Проект {project} недоступен. Обратитесь к системному администратору.', {project: 'KT'})).toBe('The project KT is unavailable. Please contact your system administrator.');
    });

    test('RHS_STRINGS follow the language', () => {
        expect(RHS_STRINGS.cancel).toBe('Отмена');
        setUILanguage('en');
        expect(RHS_STRINGS.cancel).toBe('Cancel');
    });

    test('plural forms', () => {
        const ru: [string, string, string] = ['задача', 'задачи', 'задач'];
        const en: [string, string] = ['issue', 'issues'];
        expect([1, 2, 5, 11, 21].map((n) => plural(n, ru, en))).toEqual(['задача', 'задачи', 'задач', 'задач', 'задача']);
        setUILanguage('en');
        expect([1, 2, 21].map((n) => plural(n, ru, en))).toEqual(['issue', 'issues', 'issues']);
    });

    test('dates and times', () => {
        const now = Date.parse('2026-11-05T12:00:00Z');
        expect(formatRHSShortDate(now, now)).toBe('5 ноя');
        setUILanguage('en');
        expect(formatRHSShortDate(now, now)).toBe('5 Nov');
        expect(formatRHSRelativeTime('2026-11-05T09:00:00Z', now)).toBe('3 h ago');
    });

    test('every string passed to tr has an English translation', () => {
        const missing: string[] = [];
        sourceFiles(join(__dirname, '..')).forEach((file) => {
            const source = readFileSync(file, 'utf8');
            for (const match of source.matchAll(/\btr\('((?:[^'\\]|\\.)*)'/g)) {
                const text = match[1].replace(/\\'/g, "'");
                if (!TR_EN[text]) {
                    missing.push(text);
                }
            }
        });
        expect(missing).toEqual([]);
    });
});
