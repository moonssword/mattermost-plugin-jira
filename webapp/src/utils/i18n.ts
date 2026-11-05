// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TR_EN} from './i18n_en';

// Russian is the source language of the plugin UI; English is the translation.
export type UILanguage = 'ru' | 'en';

let current: UILanguage = 'ru';

export function getCurrentUILanguage(): UILanguage {
    return current;
}

// setUILanguage is called with the language the user's settings resolve to.
// Components read the text while rendering, so they follow it on the next render.
export function setUILanguage(language: UILanguage): void {
    current = language;
}

export function uiLanguageForLocale(locale: string | undefined): UILanguage {
    return (locale || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

// tr translates a Russian source string, with {name} placeholders.
export function tr(source: string, params?: {[name: string]: string | number}): string {
    let text = current === 'en' ? (TR_EN[source] ?? source) : source;
    Object.keys(params || {}).forEach((name) => {
        text = text.replace('{' + name + '}', String(params?.[name]));
    });
    return text;
}

// plural picks the form for a count: Russian has three, English two.
export function plural(n: number, ru: [string, string, string], en: [string, string]): string {
    const abs = Math.abs(Math.trunc(n));
    if (current === 'en') {
        return abs === 1 ? en[0] : en[1];
    }
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod10 === 1 && mod100 !== 11) {
        return ru[0];
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
        return ru[1];
    }
    return ru[2];
}
