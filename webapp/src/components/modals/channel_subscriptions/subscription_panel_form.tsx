// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {tr} from 'utils/i18n';

type Props = {
    error: string | null;
    canDelete: boolean;
    canSave: boolean;
    saving: boolean;
    saveText: string;
    onSave: (event?: React.FormEvent) => void;
    onDelete: () => void;
    onCancel: () => void;
    children: React.ReactNode;
};

// SubscriptionPanelForm is the frame of the subscription form inside the panel:
// the dense style of the panel forms around the fields of the shared form.
export default function SubscriptionPanelForm(props: Props): JSX.Element {
    return (
        <form
            role='form'
            className='jira-rhs-form jira-rhs-form--dense jira-rhs-subscription-form'
            style={{'--jira-rhs-required-text': JSON.stringify(tr('Обязательное поле'))} as React.CSSProperties}
            onSubmit={props.onSave}
            onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && props.canSave) {
                    props.onSave(event);
                }
            }}
        >
            <div className='jira-rhs-form-body'>
                {props.error && (
                    <div
                        className='jira-rhs-card-alert'
                        role='alert'
                    >
                        {props.error}
                    </div>
                )}
                {props.children}
            </div>
            <div className='jira-rhs-form-footer'>
                {props.canDelete && (
                    <button
                        type='button'
                        className='btn btn-tertiary btn-danger jira-rhs-form-delete'
                        data-testid='rhs-subscription-form-delete'
                        onClick={props.onDelete}
                    >
                        {tr('Удалить')}
                    </button>
                )}
                <button
                    type='button'
                    className='btn btn-tertiary'
                    data-testid='rhs-subscription-form-cancel'
                    onClick={props.onCancel}
                >
                    {tr('Отмена')}
                </button>
                <button
                    type='submit'
                    className='btn btn-primary'
                    data-testid='rhs-subscription-form-save'
                    disabled={!props.canSave || props.saving}
                >
                    {props.saving ? tr('Сохраняем…') : props.saveText}
                </button>
            </div>
        </form>
    );
}
