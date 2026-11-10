// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';

import {Theme} from 'mattermost-redux/selectors/entities/preferences';

import {isFieldSupported} from 'components/jira_field';
import Validator from 'components/validator';
import {CreateIssueFields, JiraField} from 'types/model';
import {RHSTransition, RHSTransitionValues} from 'types/rhs_issue';

import PanelFields from '../sections/create/panel_fields';
import {preventImplicitSubmit} from '../rhs_form_keys';
import {RHS_STRINGS} from '../rhs_strings';

const EPIC_LINK = 'com.pyxis.greenhopper.jira:gh-epic-link';

export type Props = {
    transition: RHSTransition;
    fields: {[key: string]: JiraField};
    instanceID: string;
    projectKey: string;
    browseUrl: string;
    theme: Theme;
    busy: boolean;
    error: string;
    onSubmit: (values: RHSTransitionValues) => void;
    onCancel: () => void;
};

// splitScreenFields separates what the panel can edit from what only Jira can.
// The epic picker needs the create metadata, which a transition does not have.
export function splitScreenFields(fields: {[key: string]: JiraField}) {
    const shown: {[key: string]: JiraField} = {};
    const hidden: JiraField[] = [];
    Object.keys(fields).forEach((key) => {
        const field = fields[key];
        if (isFieldSupported(field) && field.schema.custom !== EPIC_LINK) {
            shown[key] = field;
        } else {
            hidden.push(field);
        }
    });
    return {shown, hidden};
}

function isEmptyValue(value: unknown): boolean {
    if (value === null || typeof value === 'undefined' || value === '') {
        return true;
    }
    if (Array.isArray(value)) {
        return value.length === 0;
    }
    if (typeof value === 'object') {
        const id = (value as {id?: unknown}).id;
        return 'id' in (value as object) && (id === null || typeof id === 'undefined' || id === '');
    }
    return false;
}

// cleanScreenValues drops the fields left empty: Jira keeps their values.
export function cleanScreenValues(values: {[key: string]: unknown}): {[key: string]: unknown} {
    const out: {[key: string]: unknown} = {};
    Object.keys(values).forEach((key) => {
        if (!isEmptyValue(values[key])) {
            out[key] = values[key];
        }
    });
    return out;
}

// TransitionForm is the screen Jira shows for a transition, for example the
// required resolution on closing an issue.
export default function TransitionForm(props: Props): JSX.Element {
    const validator = useRef(new Validator());
    const [values, setValues] = useState<{[key: string]: unknown}>({});
    const [comment, setComment] = useState('');
    const {shown, hidden} = splitScreenFields(props.fields);
    const blocked = hidden.filter((field) => field.required);

    const submit = (event?: React.FormEvent) => {
        event?.preventDefault();
        if (props.busy || blocked.length || !validator.current.validate()) {
            return;
        }
        props.onSubmit({fields: cleanScreenValues(values), comment: comment.trim()});
    };

    return (
        <form
            className='jira-rhs-form jira-rhs-form--dense'
            data-testid='rhs-transition-form'
            style={{'--jira-rhs-required-text': JSON.stringify(RHS_STRINGS.createRequired)} as React.CSSProperties}
            onSubmit={submit}
            onKeyDown={(event) => {
                preventImplicitSubmit(event);
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    submit();
                }
            }}
        >
            <div className='jira-rhs-form-header'>
                <h3 className='jira-rhs-form-title'>
                    {RHS_STRINGS.transitionTitle.replace('{status}', props.transition.to.name)}
                </h3>
            </div>
            <div className='jira-rhs-form-body'>
                {props.error && (
                    <div
                        className='jira-rhs-card-alert'
                        role='alert'
                        data-testid='rhs-transition-error'
                    >
                        {props.error}
                    </div>
                )}
                {blocked.length > 0 && (
                    <div
                        className='jira-rhs-card-alert'
                        role='alert'
                        data-testid='rhs-transition-blocked'
                    >
                        {RHS_STRINGS.transitionBlocked.replace('{fields}', blocked.map((f) => f.name).join(', '))}
                        {' '}
                        <a
                            href={props.browseUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            {RHS_STRINGS.openInJira}
                        </a>
                    </div>
                )}
                <PanelFields
                    fields={shown}
                    instanceID={props.instanceID}
                    issueMetadata={null}
                    values={{...values, project: {key: props.projectKey}} as unknown as CreateIssueFields}
                    theme={props.theme}
                    onChange={(key, value) => setValues((current) => ({...current, [key]: value}))}
                    addValidate={validator.current.addComponent}
                    removeValidate={validator.current.removeComponent}
                />
                <div className='form-group'>
                    <label
                        className='control-label'
                        htmlFor='rhs-transition-comment'
                    >
                        {RHS_STRINGS.transitionComment}
                    </label>
                    <textarea
                        id='rhs-transition-comment'
                        className='form-control'
                        data-testid='rhs-transition-comment'
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                    />
                </div>
                <p className='jira-rhs-small jira-rhs-muted'>
                    {RHS_STRINGS.transitionEmptyHint}
                    {hidden.length > blocked.length && (
                        ' ' + RHS_STRINGS.transitionHidden.replace('{fields}', hidden.filter((f) => !f.required).map((f) => f.name).join(', '))
                    )}
                </p>
            </div>
            <div className='jira-rhs-form-footer'>
                <button
                    type='button'
                    className='btn btn-tertiary'
                    data-testid='rhs-transition-cancel'
                    onClick={props.onCancel}
                >
                    {RHS_STRINGS.cancel}
                </button>
                <button
                    type='submit'
                    className='btn btn-primary'
                    data-testid='rhs-transition-submit'
                    title={RHS_STRINGS.createShortcut}
                    disabled={props.busy || blocked.length > 0}
                >
                    {props.busy ? RHS_STRINGS.transitionSubmitting : RHS_STRINGS.transitionSubmit}
                </button>
            </div>
        </form>
    );
}
