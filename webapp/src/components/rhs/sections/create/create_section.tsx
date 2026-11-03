// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';

import {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {Post} from '@mattermost/types/posts';

import {isFieldSupported} from 'components/jira_field';
import JiraFields from 'components/jira_fields';
import ReactSelectSetting from 'components/react_select_setting';
import Validator from 'components/validator';
import {
    APIResponse,
    CreateIssueFields,
    CreateIssueRequest,
    IssueMetadata,
    JiraField,
    ProjectMetadata,
    ReactSelectOption,
} from 'types/model';
import {RHSCreatePrefill} from 'types/rhs_create';
import {getFields, getIssueTypes} from 'utils/jira_issue_metadata';

import {RHSLoadingState} from '../../rhs_states';
import {RHS_STRINGS} from '../../rhs_strings';

type Result<T> = Promise<{data?: T; error?: {message?: string} | Error}>;

export type Props = {
    instanceID: string;
    channelId: string;
    teamName: string;
    theme: Theme;
    prefill: RHSCreatePrefill;
    post: Post | null;
    postAuthor: string;
    fetchJiraProjectMetadata: (instanceID: string) => Result<ProjectMetadata>;
    fetchJiraIssueMetadataForProjects: (projectKeys: string[], instanceID: string) => Promise<APIResponse<IssueMetadata>>;
    createIssue: (issue: CreateIssueRequest) => Result<{key?: string}>;
    openRHSIssue: (key: string) => unknown;
    clearRHSCreate: () => unknown;
    openCreateModal: (postId: string) => unknown;
    openCreateModalWithoutPost: (description: string, channelId: string) => unknown;
};

// unsupportedRequiredFields lists required fields the panel cannot render;
// the server then asks the user to finish the issue in Jira.
export function unsupportedRequiredFields(fields: {[key: string]: JiraField}): string[][] {
    const out: string[][] = [];
    Object.keys(fields).forEach((key) => {
        const field = fields[key];
        if (field.required && !isFieldSupported(field)) {
            out.push([key, field.name]);
        }
    });
    return out;
}

// ReactSelectSetting's declared props miss label, required and its real
// onChange(name, value) signature; describe what the panel passes.
type SelectSettingProps = {
    name: string;
    label: string;
    required: boolean;
    options: ReactSelectOption[];
    isMulti: false;
    theme: Theme;
    isLoading?: boolean;
    value: ReactSelectOption | null;
    onChange: (name: string, value: string) => void;
    addValidate: (isValid: () => boolean) => void;
    removeValidate: (isValid: () => boolean) => void;
};
const SelectSetting = ReactSelectSetting as unknown as React.ComponentType<SelectSettingProps>;

// Fields every create form fills or Jira fills itself.
const BASIC_FIELDS = new Set(['summary', 'description', 'project', 'issuetype', 'reporter']);

// defaultIssueType picks the first type that needs nothing beyond the basic
// fields (so not an Epic with its required "Epic Name"), else the first one.
export function defaultIssueType<T extends {fields: {[key: string]: JiraField}}>(types: T[]): T | undefined {
    const simple = types.find((t) => Object.keys(t.fields || {}).every((key) => BASIC_FIELDS.has(key) || !t.fields[key].required));
    return simple || types[0];
}

// panelFieldDefs relaxes the reporter: Jira's REST API fills it with the
// connected user when it is left empty, so the panel does not force a choice.
export function panelFieldDefs(fields: {[key: string]: JiraField}): {[key: string]: JiraField} {
    const out: {[key: string]: JiraField} = {};
    Object.keys(fields).forEach((key) => {
        const field = fields[key];
        out[key] = key === 'reporter' && field.required ? {...field, required: false} : field;
    });
    return out;
}

function errorText(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error && typeof (error as {message: unknown}).message === 'string') {
        return (error as {message: string}).message;
    }
    return RHS_STRINGS.cardActionFailed;
}

function initialFields(prefill: RHSCreatePrefill): CreateIssueFields {
    return {
        summary: prefill.summary,
        description: prefill.description,
        project: {key: ''},
        issuetype: {id: ''},
    } as CreateIssueFields;
}

// CreateSection is the in-panel version of the "Create Jira issue" modal. It
// reuses the plugin's metadata loading and dynamic Jira field components.
export default function CreateSection(props: Props): JSX.Element {
    const {instanceID, prefill} = props;
    const validator = useRef(new Validator());

    const [projects, setProjects] = useState<ReactSelectOption[] | null>(null);
    const [projectKey, setProjectKey] = useState('');
    const [issueTypeID, setIssueTypeID] = useState('');
    const [metadata, setMetadata] = useState<IssueMetadata | null>(null);
    const [loadingMeta, setLoadingMeta] = useState(false);
    const [fields, setFields] = useState<CreateIssueFields>(() => initialFields(prefill));
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [created, setCreated] = useState<{key: string} | null>(null);
    const [replyInThread, setReplyInThread] = useState(true);
    const savedIssueType = useRef('');

    // A new prefill (another message) restarts the form with its text.
    useEffect(() => {
        setFields((current) => ({...current, summary: prefill.summary, description: prefill.description} as CreateIssueFields));
        setCreated(null);
        setError('');
        setReplyInThread(true);
    }, [prefill.nonce]);

    const loadIssueMetadata = async (key: string, preferredType: string) => {
        setLoadingMeta(true);
        const {data, error: metaError} = await props.fetchJiraIssueMetadataForProjects([key], instanceID);
        setLoadingMeta(false);
        if (metaError || !data) {
            setError(errorText(metaError));
            setMetadata(null);
            return;
        }
        setMetadata(data);
        const types = getIssueTypes(data, key, {includeSubtasks: false});
        const type = types.find((t) => t.id === preferredType) || defaultIssueType(types);
        setIssueTypeID(type ? type.id : '');
        setFields((current) => ({...current, project: {key}, issuetype: {id: type ? type.id : ''}} as CreateIssueFields));
    };

    useEffect(() => {
        let cancelled = false;
        if (!instanceID) {
            return () => {
                cancelled = true;
            };
        }
        setProjects(null);
        setProjectKey('');
        setMetadata(null);
        props.fetchJiraProjectMetadata(instanceID).then(({data, error: projectError}) => {
            if (cancelled) {
                return;
            }
            if (projectError || !data) {
                setError(errorText(projectError));
                setProjects([]);
                return;
            }
            setProjects(data.projects || []);
            const saved = data.saved_field_values;
            savedIssueType.current = saved?.issue_type || '';
            const savedKey = saved?.project_key;
            if (savedKey && (data.projects || []).some((p) => p.value === savedKey)) {
                setProjectKey(savedKey);
                loadIssueMetadata(savedKey, savedIssueType.current);
            }
        });
        return () => {
            cancelled = true;
        };

    // Projects depend on the instance only; the loaders are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instanceID]);

    const onProjectChange = (_: string, value: string) => {
        if (!value || value === projectKey) {
            return;
        }
        setError('');
        setProjectKey(value);
        setMetadata(null);
        loadIssueMetadata(value, issueTypeID || savedIssueType.current);
    };

    const onIssueTypeChange = (_: string, value: string) => {
        setIssueTypeID(value);
        setFields((current) => ({
            summary: current.summary,
            description: current.description,
            project: {key: projectKey},
            issuetype: {id: value},
        } as CreateIssueFields));
    };

    const onFieldChange = (key: string, value: JiraField) => {
        setFields((current) => {
            const next = {...current};
            const cleared = !value || (typeof value === 'object' && 'id' in value && (value as {id: unknown}).id === null);
            if (cleared) {
                delete next[key];
            } else {
                next[key] = value;
            }
            return next;
        });
    };

    const reset = () => {
        setCreated(null);
        setError('');
        setReplyInThread(true);
        setFields({
            ...initialFields({...prefill, summary: '', description: ''}),
            project: {key: projectKey},
            issuetype: {id: issueTypeID},
        } as CreateIssueFields);
        props.clearRHSCreate();
    };

    // The full-size modal stays available, with the same message or text.
    const openInModal = () => {
        if (props.post) {
            props.openCreateModal(props.post.id);
        } else {
            props.openCreateModalWithoutPost(String(fields.description || ''), props.channelId);
        }
        props.clearRHSCreate();
    };

    const fieldDefs = panelFieldDefs(getFields(metadata, projectKey, issueTypeID));
    const unsupported = unsupportedRequiredFields(fieldDefs);

    const onSubmit = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (submitting || !validator.current.validate()) {
            return;
        }
        if (unsupported.length) {
            setError(RHS_STRINGS.createUnsupportedFields.replace('{fields}', unsupported.map((f) => f[1]).join(', ')));
            return;
        }
        setSubmitting(true);
        setError('');
        const post = props.post;
        const {data, error: createError} = await props.createIssue({
            instance_id: instanceID,
            post_id: post ? post.id : '',
            current_team: props.teamName,
            channel_id: post ? post.channel_id : props.channelId,
            fields,
            required_fields_not_covered: [],
            skip_public_reply: !replyInThread,
        });
        if (createError || !data?.key) {
            setSubmitting(false);
            setError(errorText(createError));
            return;
        }
        setSubmitting(false);
        setCreated({key: data.key});
        props.clearRHSCreate();
    };

    if (created) {
        return (
            <div
                className='jira-rhs-placeholder'
                data-testid='rhs-create-done'
            >
                <h4 className='jira-rhs-placeholder-title'>{RHS_STRINGS.createDone.replace('{key}', created.key)}</h4>
                <div className='jira-rhs-form-buttons'>
                    <button
                        type='button'
                        className='btn btn-primary'
                        data-testid='rhs-create-open-card'
                        onClick={() => props.openRHSIssue(created.key)}
                    >
                        {RHS_STRINGS.createOpenCard}
                    </button>
                    <button
                        type='button'
                        className='btn btn-tertiary'
                        data-testid='rhs-create-another'
                        onClick={reset}
                    >
                        {RHS_STRINGS.createAnother}
                    </button>
                </div>
            </div>
        );
    }

    if (projects === null) {
        return <RHSLoadingState/>;
    }

    const projectOptions = projects;
    const typeOptions = getIssueTypes(metadata, projectKey, {includeSubtasks: false}).map((t) => ({label: t.name, value: t.id}));
    const ready = Boolean(projectKey && metadata && issueTypeID);

    return (
        <form
            className='jira-rhs-form'
            data-testid='rhs-create-form'
            onSubmit={onSubmit}
        >
            <div className='jira-rhs-form-body'>
                <div className='jira-rhs-form-top'>
                    <button
                        type='button'
                        className='jira-rhs-link-button'
                        data-testid='rhs-create-in-modal'
                        onClick={openInModal}
                    >
                        <i
                            className='icon icon-arrow-expand'
                            aria-hidden={true}
                        />
                        {RHS_STRINGS.createInModal}
                    </button>
                </div>
                {props.post && (
                    <blockquote
                        className='jira-rhs-quote'
                        data-testid='rhs-create-quote'
                    >
                        <b>{RHS_STRINGS.createFrom + (props.postAuthor ? ' ' + props.postAuthor : '')}</b>
                        <span>{summaryLine(props.post.message)}</span>
                    </blockquote>
                )}
                {error && (
                    <div
                        className='jira-rhs-card-alert'
                        role='alert'
                        data-testid='rhs-create-error'
                    >
                        {error}
                    </div>
                )}
                {projectOptions.length === 0 ? (
                    <p className='jira-rhs-muted'>{RHS_STRINGS.createNoProjects}</p>
                ) : (
                    <div className='jira-rhs-form-two'>
                        <SelectSetting
                            name='project'
                            label={RHS_STRINGS.createProject}
                            required={true}
                            options={projectOptions}
                            isMulti={false}
                            theme={props.theme}
                            value={projectOptions.find((o) => o.value === projectKey) || null}
                            onChange={onProjectChange}
                            addValidate={validator.current.addComponent}
                            removeValidate={validator.current.removeComponent}
                        />
                        {projectKey && (
                            <SelectSetting
                                name='issue_type'
                                label={RHS_STRINGS.createIssueType}
                                required={true}
                                options={typeOptions}
                                isMulti={false}
                                theme={props.theme}
                                isLoading={loadingMeta}
                                value={typeOptions.find((o) => o.value === issueTypeID) || null}
                                onChange={onIssueTypeChange}
                                addValidate={validator.current.addComponent}
                                removeValidate={validator.current.removeComponent}
                            />
                        )}
                    </div>
                )}
                {loadingMeta && <RHSLoadingState/>}
                {ready && !loadingMeta && (
                    <JiraFields
                        fields={fieldDefs}
                        instanceID={instanceID}
                        issueMetadata={metadata}
                        onChange={onFieldChange}
                        values={fields}
                        theme={props.theme}
                        addValidate={validator.current.addComponent}
                        removeValidate={validator.current.removeComponent}
                        isFilter={false}
                    />
                )}
                {ready && (
                    <label className='jira-rhs-checkbox'>
                        <input
                            type='checkbox'
                            data-testid='rhs-create-reply'
                            checked={replyInThread}
                            onChange={(event) => setReplyInThread(event.target.checked)}
                        />
                        {props.post ? RHS_STRINGS.createReplyInThread : RHS_STRINGS.createPostToChannel}
                    </label>
                )}
            </div>
            <div className='jira-rhs-form-footer'>
                <button
                    type='button'
                    className='btn btn-tertiary'
                    data-testid='rhs-create-cancel'
                    onClick={reset}
                >
                    {RHS_STRINGS.cancel}
                </button>
                <button
                    type='submit'
                    className='btn btn-primary'
                    data-testid='rhs-create-submit'
                    disabled={!ready || submitting || loadingMeta}
                >
                    {submitting ? RHS_STRINGS.createCreating : RHS_STRINGS.createSubmit}
                </button>
            </div>
        </form>
    );
}

function summaryLine(message: string): string {
    const text = message.replace(/\s+/g, ' ').trim();
    return text.length > 160 ? text.slice(0, 159) + '…' : text;
}
