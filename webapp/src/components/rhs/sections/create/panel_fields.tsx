// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Theme} from 'mattermost-redux/selectors/entities/preferences';

import JiraFieldComponent, {isFieldSupported} from 'components/jira_field';
import {CreateIssueFields, IssueMetadata, JiraField} from 'types/model';

export type Props = {
    fields: {[key: string]: JiraField};
    instanceID: string;
    issueMetadata: IssueMetadata | null;
    values: CreateIssueFields;
    theme: Theme;
    onChange: (key: string, value: JiraField) => void;
    addValidate: (isValid: () => boolean) => void;
    removeValidate: (isValid: () => boolean) => void;
};

const TEXTAREA = 'com.atlassian.jira.plugin.system.customfieldtypes:textarea';
const LABELS = 'com.atlassian.jira.plugin.system.customfieldtypes:labels';

// isWideField tells which fields need the full panel width. The rest are
// short pickers and inputs that sit in pairs (form variant Ф1).
export function isWideField(key: string, field: JiraField): boolean {
    const schema = field.schema || {};
    return key === 'summary' ||
        key === 'description' ||
        schema.system === 'description' ||
        schema.system === 'labels' ||
        schema.custom === TEXTAREA ||
        schema.custom === LABELS;
}

// sortPanelFields keeps the order of the plugin's create modal: summary and
// description first, then required fields, then the rest by name.
export function sortPanelFields(fields: {[key: string]: JiraField}): string[] {
    const keys = Object.keys(fields);
    const start = ['summary', 'description'].filter((k) => keys.includes(k));
    const rest = keys.filter((key) => {
        if (['summary', 'description', 'issuetype', 'project'].includes(key)) {
            return false;
        }
        return isFieldSupported(fields[key]);
    }).sort((a, b) => {
        const f1 = fields[a];
        const f2 = fields[b];
        if (f1.required !== f2.required) {
            return f1.required ? -1 : 1;
        }
        return f1.name > f2.name ? 1 : -1;
    });
    return start.concat(rest);
}

// PanelFields renders the Jira fields of the chosen issue type with the
// plugin's own field components, laid out on a two-column grid.
export default function PanelFields(props: Props): JSX.Element {
    const projectKey = props.values?.project?.key;
    return (
        <div
            className='jira-rhs-fields'
            data-testid='rhs-create-fields'
        >
            {sortPanelFields(props.fields).map((key) => {
                const field = props.fields[key];
                return (
                    <div
                        key={key}
                        className={isWideField(key, field) ? 'jira-rhs-field jira-rhs-field--wide' : 'jira-rhs-field'}
                        data-testid={'rhs-field-' + key}
                    >
                        <JiraFieldComponent
                            instanceID={props.instanceID}
                            id={key}
                            issueMetadata={props.issueMetadata}
                            projectKey={projectKey}
                            field={field}
                            obeyRequired={true}
                            onChange={props.onChange}
                            value={props.values && props.values[key]}
                            isFilter={false}
                            theme={props.theme}
                            addValidate={props.addValidate}
                            removeValidate={props.removeValidate}
                        />
                    </div>
                );
            })}
        </div>
    );
}
