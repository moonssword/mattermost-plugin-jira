// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import manifest from '../../../manifest';

import {COMMON_TEXT, SettingDescriptor, SettingLanguage} from './settings_text';

export type Props = {
    id: string;
    value?: unknown;
    disabled?: boolean;
    setByEnv?: boolean;
    onChange: (id: string, value: unknown) => void;
    setSaveNeeded?: () => void;
    config?: {PluginSettings?: {Plugins?: {[plugin: string]: {[key: string]: unknown}}}};
    language: SettingLanguage;
    descriptor: SettingDescriptor;
};

// settingValue finds the stored value. The System Console looks settings up by
// the lowercase key, while Mattermost stores the defaults of a new installation
// under the key as the manifest spells it; the plugin reads either of them, and
// the lowercase one wins.
export function settingValue(props: Pick<Props, 'value' | 'config' | 'descriptor'>): unknown {
    if (typeof props.value !== 'undefined' && props.value !== null) {
        return props.value;
    }
    const stored = props.config?.PluginSettings?.Plugins?.[manifest.id]?.[props.descriptor.key];
    if (typeof stored !== 'undefined' && stored !== null) {
        return stored;
    }
    return props.descriptor.defaultValue;
}

// The radio buttons of the System Console are styled by Mattermost's own
// components, which plugins cannot use.
const RADIO_LABEL_STYLE: React.CSSProperties = {display: 'inline-flex', alignItems: 'center', marginRight: 24, marginBottom: 0, fontWeight: 400};
const RADIO_STYLE: React.CSSProperties = {width: 16, height: 16, margin: '0 8px 0 0', accentColor: 'var(--button-bg)'};

const GENERATED_LENGTH = 32;
const GENERATED_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';

// generateSecret makes the same kind of value as the "generated" setting of
// Mattermost: 32 random URL-safe characters.
export function generateSecret(): string {
    const bytes = new Uint8Array(GENERATED_LENGTH);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => GENERATED_CHARS[b % GENERATED_CHARS.length]).join('');
}

const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`)/g;

// renderInlineText renders the small markup of the help texts as elements, so
// no HTML is ever injected.
export function renderInlineText(text: string): React.ReactNode[] {
    return text.split(INLINE).filter(Boolean).map((part, index) => {
        const key = String(index);
        if (part.startsWith('**')) {
            return <b key={key}>{part.slice(2, -2)}</b>;
        }
        if (part.startsWith('`')) {
            return <code key={key}>{part.slice(1, -1)}</code>;
        }
        const link = (/^\[([^\]]+)\]\(([^)]+)\)$/).exec(part);
        if (link) {
            return (
                <a
                    key={key}
                    href={link[2]}
                    target='_blank'
                    rel='noopener noreferrer'
                >
                    {link[1]}
                </a>
            );
        }
        return <React.Fragment key={key}>{part}</React.Fragment>;
    });
}

export function HelpText(props: {text: string}): JSX.Element {
    return (
        <div className='help-text'>
            {props.text.split('\n').filter(Boolean).map((line) => (
                <div key={line}>{renderInlineText(line)}</div>
            ))}
        </div>
    );
}

// LocalizedSetting renders one plugin setting with the markup of the System
// Console, in the language of the user. The value is stored by Mattermost as
// usual: the page saves whatever onChange reported.
export default function LocalizedSetting(props: Props): JSX.Element {
    const {descriptor, language} = props;
    const disabled = Boolean(props.disabled || props.setByEnv);
    const change = (value: unknown) => {
        props.onChange(props.id, value);
        props.setSaveNeeded?.();
    };
    const value = settingValue(props);
    const textValue = typeof value === 'undefined' || value === null ? '' : String(value);

    let control: React.ReactNode;
    switch (descriptor.kind) {
    case 'bool': {
        const on = value === true || value === 'true';
        control = (
            <>
                <label style={RADIO_LABEL_STYLE}>
                    <input
                        type='radio'
                        style={RADIO_STYLE}
                        name={props.id}
                        data-testid={props.id + '-true'}
                        checked={on}
                        disabled={disabled}
                        onChange={() => change(true)}
                    />
                    {COMMON_TEXT.yes[language]}
                </label>
                <label style={RADIO_LABEL_STYLE}>
                    <input
                        type='radio'
                        style={RADIO_STYLE}
                        name={props.id}
                        data-testid={props.id + '-false'}
                        checked={!on}
                        disabled={disabled}
                        onChange={() => change(false)}
                    />
                    {COMMON_TEXT.no[language]}
                </label>
            </>
        );
        break;
    }
    case 'radio':
        control = (descriptor.options || []).map((option) => (
            <div
                style={{marginBottom: 6}}
                key={option.value}
            >
                <label style={RADIO_LABEL_STYLE}>
                    <input
                        type='radio'
                        style={RADIO_STYLE}
                        name={props.id}
                        data-testid={props.id + '-' + option.value}
                        checked={textValue === option.value}
                        disabled={disabled}
                        onChange={() => change(option.value)}
                    />
                    {option.label[language]}
                </label>
            </div>
        ));
        break;
    case 'generated':
        control = (
            <input
                className='form-control'
                type='text'
                data-testid={props.id + '-input'}
                value={textValue}
                disabled={true}
                readOnly={true}
            />
        );
        break;
    case 'secret':
        control = (
            <input
                className='form-control'
                type='password'
                autoComplete='new-password'
                data-testid={props.id + '-input'}
                value={textValue}
                disabled={disabled}
                onChange={(event) => change(event.target.value)}
            />
        );
        break;
    default:
        control = (
            <input
                className='form-control'
                type={descriptor.kind === 'number' ? 'number' : 'text'}
                data-testid={props.id + '-input'}
                placeholder={descriptor.placeholder}
                value={textValue}
                disabled={disabled}
                onChange={(event) => change(descriptor.kind === 'number' ? Number(event.target.value) : event.target.value)}
            />
        );
    }

    return (
        <div
            className='form-group'
            data-testid={props.id + 'setting'}
        >
            <label className='control-label col-sm-4'>
                {descriptor.label[language]}
            </label>
            <div className='col-sm-8'>
                {control}
                <HelpText text={descriptor.help[language]}/>
                {descriptor.kind === 'generated' && (
                    <>
                        <div className='help-text'>
                            <button
                                type='button'
                                className='btn btn-tertiary'
                                data-testid={props.id + '-regenerate'}
                                disabled={disabled}
                                onClick={() => change(generateSecret())}
                            >
                                {COMMON_TEXT.regenerate[language]}
                            </button>
                        </div>
                        {descriptor.regenerateHelp && <HelpText text={descriptor.regenerateHelp[language]}/>}
                    </>
                )}
                {props.setByEnv && <HelpText text={COMMON_TEXT.setByEnv[language]}/>}
            </div>
        </div>
    );
}
