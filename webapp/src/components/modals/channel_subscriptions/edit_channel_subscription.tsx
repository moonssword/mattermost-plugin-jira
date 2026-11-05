// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';
import {Modal} from 'react-bootstrap';

import ReactSelectSetting from 'components/react_select_setting';
import ConfirmModal from 'components/confirm_modal';
import FormButton from 'components/form_button';
import Input from 'components/input';
import Loading from 'components/loading';
import Validator from 'components/validator';
import JiraInstanceAndProjectSelector from 'components/jira_instance_and_project_selector';

import {getBaseStyles, getModalStyles} from 'utils/styles';
import {
    filterValueIsSecurityField,
    generateJQLStringFromSubscriptionFilters,
    getConflictingFields,
    getCustomFieldFiltersForProjects,
    getCustomFieldValuesForEvents,
    getIssueTypes,
} from 'utils/jira_issue_metadata';

import {
    ChannelSubscription,
    ChannelSubscriptionFilters as ChannelSubscriptionFiltersModel,
    FilterValue,
    IssueMetadata,
    ReactSelectOption,
    SavedFieldValues,
} from 'types/model';

import {tr} from 'utils/i18n';

import ChannelSubscriptionFilters from './channel_subscription_filters';
import {getJiraEventOptions} from './jira_event_options';
import SubscriptionPanelForm from './subscription_panel_form';
import {SharedProps} from './shared_props';

export type Props = SharedProps & {
    finishEditSubscription: () => void;
    selectedSubscription: ChannelSubscription | null;
    creatingSubscription: boolean;
    creatingSubscriptionTemplate: boolean;
    selectedSubscriptionTemplate: ChannelSubscription | null;
    panel?: boolean; // the dense style of the panel forms
};

export type State = {
    filters: ChannelSubscriptionFiltersModel;
    instanceID: string;
    fetchingIssueMetadata: boolean;
    jiraIssueMetadata: IssueMetadata | null;
    templateOptions: ReactSelectOption[] | null;
    error: string | null;
    getMetaDataErr: string | null;
    submitting: boolean;
    submittingTemplate: boolean;
    subscriptionName: string | null;
    showConfirmModal: boolean;
    confirmActionType: 'delete' | 'close' | null;
    conflictingError: string | null;
    selectedTemplateID: string | null;
};

export default class EditChannelSubscription extends PureComponent<Props, State> {
    private validator: Validator;

    constructor(props: Props) {
        super(props);

        let filters: ChannelSubscriptionFiltersModel = {
            events: [],
            projects: [],
            issue_types: [],
            fields: [],
        };

        let subscriptionName = null;
        if (props.selectedSubscription) {
            filters = Object.assign({}, filters, props.selectedSubscription.filters);
            subscriptionName = props.selectedSubscription.name;
        }

        if (props.selectedSubscriptionTemplate) {
            filters = Object.assign({}, filters, props.selectedSubscriptionTemplate.filters);
            subscriptionName = props.selectedSubscriptionTemplate.name;
        }

        filters.fields = filters.fields || [];

        let instanceID = '';
        let fetchingIssueMetadata = false;
        if (this.props.selectedSubscription) {
            instanceID = this.props.selectedSubscription.instance_id;
        }

        if (this.props.selectedSubscriptionTemplate) {
            instanceID = this.props.selectedSubscriptionTemplate.instance_id;
        }

        if (filters.projects.length && instanceID) {
            fetchingIssueMetadata = true;
            this.fetchIssueMetadata(filters.projects, instanceID);
        }

        this.state = {
            error: null,
            getMetaDataErr: null,
            submitting: false,
            submittingTemplate: false,
            filters,
            fetchingIssueMetadata,
            jiraIssueMetadata: null,
            subscriptionName,
            showConfirmModal: false,
            confirmActionType: null,
            conflictingError: null,
            instanceID,
            selectedTemplateID: null,
            templateOptions: null,
        };

        this.validator = new Validator();
    }

    componentDidMount() {
        if (this.props.selectedSubscription) {
            const projects = this.props.selectedSubscription.filters.projects;
            if (projects.length) {
                this.fetchSubscriptionTemplateForProjectKey(this.state.instanceID, projects[0]);
            }
        }

        if (this.props.selectedSubscriptionTemplate) {
            const projects = this.props.selectedSubscriptionTemplate.filters.projects;
            if (projects.length) {
                this.fetchSubscriptionTemplateForProjectKey(this.state.instanceID, projects[0]);
            }
        }
    }

    handleCancel = (): void => {
        this.setState({showConfirmModal: true, confirmActionType: 'close'});
    };

    handleClose = (e?: React.FormEvent) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        this.props.finishEditSubscription();
    };

    handleNameChange = (id: string, value: string) => {
        this.setState({subscriptionName: value});
    };

    deleteChannelSubscription = () => {
        if (this.props.selectedSubscription) {
            this.props.deleteChannelSubscription(this.props.selectedSubscription).then((res) => {
                if (res.error) {
                    this.setState({error: res.error.message});
                } else {
                    this.handleClose();
                }
            });
        }

        if (this.props.selectedSubscriptionTemplate) {
            this.props.deleteSubscriptionTemplate(this.props.selectedSubscriptionTemplate).then((res) => {
                if (res.error) {
                    this.setState({error: res.error.message});
                } else {
                    this.handleClose();
                }
            });
        }
    };

    handleCancelAction = () => {
        this.setState({showConfirmModal: false});
    };

    handleConfirmAction = () => {
        if (this.state.confirmActionType === 'close') {
            this.props.finishEditSubscription();
        } else if (this.state.confirmActionType === 'delete') {
            this.deleteChannelSubscription();
        }

        this.setState({showConfirmModal: false, confirmActionType: null});
    };

    handleDeleteChannelSubscription = (): void => {
        this.setState({showConfirmModal: true, confirmActionType: 'delete'});
    };

    handleSettingChange = (id: keyof ChannelSubscriptionFiltersModel, value: string[]) => {
        let finalValue = value;
        if (!finalValue) {
            finalValue = [];
        } else if (!Array.isArray(finalValue)) {
            finalValue = [finalValue];
        }
        const filters = {...this.state.filters};
        filters[id] = finalValue;
        this.setState({filters});
        this.clearConflictingErrorMessage();
    };

    clearConflictingErrorMessage = () => {
        this.setState({conflictingError: null});
    };

    shouldShowEmptySecurityLevelMessage = (): boolean => {
        if (!this.props.securityLevelEmptyForJiraSubscriptions) {
            return false;
        }

        return !this.state.filters.fields.some(filterValueIsSecurityField);
    };

    handleIssueChange = (id: keyof ChannelSubscriptionFiltersModel, value: string[] | null) => {
        const finalValue = value || [];
        const filters = {...this.state.filters, issue_types: finalValue};

        let conflictingFields = null;
        if (finalValue.length > this.state.filters.issue_types.length) {
            const filterFields = getCustomFieldFiltersForProjects(this.state.jiraIssueMetadata, this.state.filters.projects, this.state.filters.issue_types);
            conflictingFields = getConflictingFields(
                filterFields,
                finalValue,
                this.state.jiraIssueMetadata,
            );
        }

        if (conflictingFields && conflictingFields.length) {
            const selectedConflictingFields = conflictingFields.filter((f1) => {
                return this.state.filters.fields.find((f2) => f1.field.key === f2.key);
            });

            if (selectedConflictingFields.length) {
                const fieldsStr = selectedConflictingFields.map((cf) => cf.field.name).join(', ');
                const conflictingIssueType = conflictingFields[0].issueTypes[0];

                let errorStr = tr('У типа задачи «{type}» нет полей фильтра: «{fields}». ', {type: conflictingIssueType.name, fields: fieldsStr});
                errorStr += tr('Измените эти поля или создайте отдельную подписку.');
                this.setState({conflictingError: errorStr});
                return;
            }
        }

        this.setState({filters, conflictingError: null});
    };

    fetchIssueMetadata = (projectKeys: string[], instanceID: string) => {
        if (!instanceID) {
            this.setState({getMetaDataErr: tr('Не выбран инстанс Jira.')});
        }

        this.props.fetchJiraIssueMetadataForProjects(projectKeys, instanceID).then(({data, error}) => {
            const jiraIssueMetadata = data as IssueMetadata;
            const state = {fetchingIssueMetadata: false, jiraIssueMetadata} as State;

            if (error) {
                state.getMetaDataErr = tr('Проект {project} недоступен. Обратитесь к системному администратору.', {project: projectKeys[0]});
            }

            const filterFields = getCustomFieldFiltersForProjects(jiraIssueMetadata, this.state.filters.projects, this.state.filters.issue_types);
            for (const v of this.state.filters.fields) {
                if (!filterFields.find((f) => f.key === v.key)) {
                    state.error = tr('Поле из этой подписки удалено в Jira, поэтому подписка недействительна. При сохранении формы поле будет убрано из подписки, и она снова заработает.');
                }
            }

            this.setState(state);
        });
    };

    fetchSubscriptionTemplateForProjectKey = (instanceId: string, projectId: string) => {
        this.setState({selectedTemplateID: null, fetchingIssueMetadata: true});
        this.props.fetchSubscriptionTemplatesForProjectKey(instanceId, projectId).then((subs) => {
            if (subs.error) {
                this.setState({error: subs.error.message});
                return;
            }

            const subscriptionTemplate = subs.data as ChannelSubscription[];
            let templateOptions: ReactSelectOption[] | null = null;
            if (subscriptionTemplate) {
                templateOptions = subscriptionTemplate.map((template: ChannelSubscription) => (
                    {label: template.name || template.id, value: template.id}
                ));
            }

            this.setState({templateOptions, fetchingIssueMetadata: false});
        });
    };

    handleJiraInstanceChange = (instanceID: string) => {
        if (instanceID === this.state.instanceID) {
            return;
        }

        this.setState({instanceID, error: null});
        this.handleProjectChange({});
    };

    handleProjectChange = (fieldValues: SavedFieldValues) => {
        const projectID = fieldValues.project_key ? fieldValues.project_key : '';
        this.clearConflictingErrorMessage();

        let projects: string[];
        if (projectID) {
            projects = [projectID];
        } else {
            projects = [];
        }

        if (projects.length && this.state.filters.projects[0] === projects[0]) {
            return;
        }

        const filters = {
            projects,
            issue_types: [],
            events: [],
            fields: [],
        };

        let fetchingIssueMetadata = false;

        if (projects && projects.length) {
            fetchingIssueMetadata = true;
            this.fetchIssueMetadata(projects, this.state.instanceID);
        }

        if (this.state.instanceID && projectID) {
            fetchingIssueMetadata = true;
            this.fetchSubscriptionTemplateForProjectKey(this.state.instanceID, projectID);
        }

        this.setState({
            fetchingIssueMetadata,
            getMetaDataErr: null,
            filters,
        });
    };

    handleFilterFieldChange = (fields: FilterValue[]) => {
        this.setState({filters: {...this.state.filters, fields}});
        this.clearConflictingErrorMessage();
    };

    handleCreate = (e?: React.FormEvent) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        if (!this.validator.validate()) {
            return;
        }

        if (!this.state.subscriptionName || this.state.subscriptionName.trim() === '') {
            this.setState({error: tr('Название не может быть пустым.')});
            return;
        }

        const filterFields = getCustomFieldFiltersForProjects(this.state.jiraIssueMetadata, this.state.filters.projects, this.state.filters.issue_types);
        const configuredFields = this.state.filters.fields.concat([]);
        for (const v of this.state.filters.fields) {
            if (!filterFields.find((f) => f.key === v.key)) {
                configuredFields.splice(configuredFields.indexOf(v), 1);
            }
        }

        const filters = {
            ...this.state.filters,
            fields: configuredFields,
        };

        const subscription = {
            channel_id: this.props.channel.id,
            filters,
            name: this.state.subscriptionName?.trim(),
            instance_id: this.state.instanceID,
        } as ChannelSubscription;

        if (this.props.selectedSubscriptionTemplate) {
            this.setState({submittingTemplate: true, error: null});
            subscription.id = this.props.selectedSubscriptionTemplate.id;
            this.props.editSubscriptionTemplate(subscription).then((edited) => {
                if (edited.error) {
                    this.setState({error: edited.error.message, submittingTemplate: false});
                    return;
                }

                this.handleClose(e);
            });
        } else if (this.props.creatingSubscriptionTemplate) {
            this.setState({submittingTemplate: true, error: null});
            this.props.createSubscriptionTemplate(subscription).then((created) => {
                if (created.error) {
                    this.setState({error: created.error.message, submittingTemplate: false});
                    return;
                }

                this.handleClose(e);
            });
        } else if (this.props.selectedSubscription) {
            this.setState({submitting: true, error: null});
            subscription.id = this.props.selectedSubscription.id;
            this.props.editChannelSubscription(subscription).then((edited) => {
                if (edited.error) {
                    this.setState({error: edited.error.message, submitting: false});
                    return;
                }
                this.handleClose(e);
            });
        } else {
            this.setState({submitting: true, error: null});
            this.props.createChannelSubscription(subscription).then((created) => {
                if (created.error) {
                    this.setState({error: created.error.message, submitting: false});
                    return;
                }
                this.handleClose(e);
            });
        }
    };

    handleTemplateChange = (_: any, templateId: string) => {
        const templateChoosen = this.props.subscriptionTemplates.find((template) => template.id === templateId);
        this.handleProjectChange(templateChoosen.filters.projects[0]);
        this.setState({
            filters: templateChoosen.filters,
            selectedTemplateID: templateId,
        });
    };

    render(): JSX.Element {
        const style = getModalStyles(this.props.theme);

        const issueTypes = getIssueTypes(this.state.jiraIssueMetadata, this.state.filters.projects[0], {includeSubtasks: true});
        const issueOptions = issueTypes.map((it) => ({label: it.name, value: it.id}));

        const customFields = getCustomFieldValuesForEvents(this.state.jiraIssueMetadata, this.state.filters.projects);
        const filterFields = getCustomFieldFiltersForProjects(this.state.jiraIssueMetadata, this.state.filters.projects, this.state.filters.issue_types);

        const eventOptions = getJiraEventOptions().concat(customFields);

        let conflictingErrorComponent = null;
        if (this.state.conflictingError) {
            conflictingErrorComponent = (
                <p className='help-text error-text'>
                    <span>{this.state.conflictingError}</span>
                </p>
            );
        }

        let component = null;
        if (this.props.channel && this.props.channelSubscriptions) {
            let innerComponent = null;
            if (this.state.fetchingIssueMetadata) {
                innerComponent = <Loading/>;
            } else if (this.state.filters.projects[0] && !this.state.getMetaDataErr && this.state.jiraIssueMetadata) {
                innerComponent = (
                    <React.Fragment>
                        <ReactSelectSetting
                            name='template'
                            label={tr('Использовать шаблон')}
                            options={this.state.templateOptions}
                            onChange={this.handleTemplateChange}
                            value={this.state.templateOptions && this.state.templateOptions.find((option) => option.value === this.state.selectedTemplateID)}
                            required={false}
                            theme={this.props.theme}
                            isLoading={false}
                        />
                        <ReactSelectSetting
                            name='events'
                            label={tr('События')}
                            required={true}
                            onChange={this.handleSettingChange}
                            options={eventOptions}
                            isMulti={true}
                            theme={this.props.theme}
                            value={eventOptions.filter((option) => this.state.filters.events.includes(option.value))}
                            addValidate={this.validator.addComponent}
                            removeValidate={this.validator.removeComponent}
                        />
                        <ReactSelectSetting
                            name='issue_types'
                            label={tr('Типы задач')}
                            required={true}
                            onChange={this.handleIssueChange}
                            options={issueOptions}
                            isMulti={true}
                            theme={this.props.theme}
                            value={issueOptions.filter((option) => this.state.filters.issue_types.includes(option.value))}
                            addValidate={this.validator.addComponent}
                            removeValidate={this.validator.removeComponent}
                        />
                        {conflictingErrorComponent}
                        <ChannelSubscriptionFilters
                            fields={filterFields}
                            values={this.state.filters.fields}
                            chosenIssueTypes={this.state.filters.issue_types}
                            issueMetadata={this.state.jiraIssueMetadata}
                            theme={this.props.theme}
                            onChange={this.handleFilterFieldChange}
                            addValidate={this.validator.addComponent}
                            removeValidate={this.validator.removeComponent}
                            instanceID={this.state.instanceID}
                            securityLevelEmptyForJiraSubscriptions={this.props.securityLevelEmptyForJiraSubscriptions}
                            searchTeamFields={this.props.searchTeamFields}
                            projectKey={this.state.filters.projects[0] || ''}
                        />
                        <div>
                            <label className='control-label margin-bottom'>
                                {tr('Примерный запрос JQL')}
                            </label>
                            <div style={getBaseStyles(this.props.theme).codeBlock}>
                                <span>{generateJQLStringFromSubscriptionFilters(this.state.jiraIssueMetadata, filterFields, this.state.filters, this.props.securityLevelEmptyForJiraSubscriptions)}</span>
                            </div>
                            {this.shouldShowEmptySecurityLevelMessage() && (
                                <div>
                                    <span>
                                        <strong>{tr('Обратите внимание:')}</strong>
                                        {tr(' фильтр по уровню безопасности не выбран, поэтому подписка будет срабатывать только для задач без уровня безопасности.')}
                                    </span>
                                </div>
                            )}
                            <div className='channel-subscriptions-modal__learnMore'>
                                <a
                                    href='https://github.com/mattermost/mattermost-plugin-jira#create-a-channel-subscription'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                >{tr('Подробнее')}</a>
                            </div>
                        </div>
                    </React.Fragment>
                );
            }

            component = (
                <React.Fragment>
                    <div className='container-fluid'>
                        <Input
                            label={tr('Название подписки')}
                            placeholder={tr('Название')}
                            type={'input'}
                            maxLength={100}
                            required={true}
                            onChange={this.handleNameChange}
                            value={this.state.subscriptionName}
                            readOnly={false}
                            addValidate={this.validator.addComponent}
                            removeValidate={this.validator.removeComponent}
                        />
                    </div>
                    <div className='container-fluid'>
                        <JiraInstanceAndProjectSelector
                            selectedInstanceID={this.state.instanceID}
                            selectedProjectID={this.state.filters.projects[0]}
                            onInstanceChange={this.handleJiraInstanceChange}
                            onProjectChange={this.handleProjectChange}
                            onError={(error: string) => this.setState({error})}

                            theme={this.props.theme}
                            addValidate={this.validator.addComponent}
                            removeValidate={this.validator.removeComponent}
                        />
                        {innerComponent}
                    </div>
                </React.Fragment>
            );
        } else {
            component = <Loading/>;
        }

        const {showConfirmModal} = this.state;

        let confirmMessage = tr('Отменить внесённые изменения?');
        if (this.state.confirmActionType === 'delete') {
            confirmMessage = this.props.selectedSubscription?.name ? tr('Удалить подписку «{name}»?', {name: this.props.selectedSubscription.name}) : tr('Удалить подписку?');
            if (this.props.selectedSubscriptionTemplate) {
                confirmMessage = this.props.selectedSubscriptionTemplate.name ? tr('Удалить шаблон подписки «{name}»?', {name: this.props.selectedSubscriptionTemplate.name}) : tr('Удалить шаблон подписки?');
            }
        }

        let confirmComponent;
        if (this.props.selectedSubscription || this.props.selectedSubscriptionTemplate || this.props.creatingSubscriptionTemplate) {
            confirmComponent = (
                <ConfirmModal
                    cancelButtonText={tr('Назад')}
                    confirmButtonText={this.state.confirmActionType === 'delete' ? tr('Удалить') : tr('Отменить изменения')}
                    confirmButtonClass={'btn btn-danger'}
                    hideCancel={false}
                    message={confirmMessage}
                    onCancel={this.handleCancelAction}
                    onConfirm={this.handleConfirmAction}
                    show={this.state.showConfirmModal}
                    title={this.props.selectedSubscription ? tr('Подписка') : tr('Шаблон подписки')}
                />
            );
        }

        let error = null;
        if (this.state.error || this.state.getMetaDataErr) {
            error = (
                <p className='help-text error-text'>
                    <span>{this.state.error || this.state.getMetaDataErr}</span>
                </p>
            );
        }

        const enableSubmitButton = Boolean(this.state.filters.projects[0]);
        const enableDeleteButton = Boolean(this.props.selectedSubscription || this.props.selectedSubscriptionTemplate);
        let saveSubscriptionButtonText = '';
        let headerText = '';
        if (this.props.selectedSubscription || this.props.creatingSubscription) {
            saveSubscriptionButtonText = tr('Сохранить');
            headerText = tr('Изменение подписки Jira в канале ');
            if (this.props.creatingSubscription) {
                saveSubscriptionButtonText = tr('Создать подписку');
                headerText = tr('Новая подписка Jira в канале ');
            }
        } else {
            saveSubscriptionButtonText = tr('Создать шаблон');
            headerText = tr('Новый шаблон подписки');
            if (this.props.selectedSubscriptionTemplate && this.props.selectedSubscriptionTemplate.name) {
                saveSubscriptionButtonText = tr('Сохранить шаблон');
                headerText = tr('Изменение шаблона подписки');
            }
        }

        if (this.props.panel) {
            return (
                <SubscriptionPanelForm
                    error={this.state.error || this.state.getMetaDataErr}
                    canDelete={enableDeleteButton}
                    canSave={enableSubmitButton}
                    saving={this.state.submitting}
                    saveText={saveSubscriptionButtonText}
                    onSave={this.handleCreate}
                    onDelete={this.handleDeleteChannelSubscription}
                    onCancel={this.handleCancel}
                >
                    {component}
                    {confirmComponent}
                </SubscriptionPanelForm>
            );
        }

        return (
            <form
                role='form'
            >
                <div className='margin-bottom x3 text-center'>
                    {this.props.selectedSubscription || this.props.creatingSubscription ? <h2>{headerText}<strong>{this.props.channel.display_name}</strong></h2> : <h2>{headerText}</h2>}
                </div>
                <div style={style.modalBody}>
                    {component}
                    {error}
                    {confirmComponent}
                </div>
                <Modal.Footer style={style.modalFooter}>
                    <FormButton
                        id='jira-delete-subscription'
                        type='button'
                        btnClass='btn-danger pull-left'
                        defaultMessage={tr('Удалить')}
                        disabled={!enableDeleteButton}
                        onClick={this.handleDeleteChannelSubscription}
                    />
                    <FormButton
                        type='button'
                        btnClass='btn-link'
                        defaultMessage={tr('Отмена')}
                        onClick={this.handleCancel}
                    />
                    <FormButton
                        type='button'
                        onClick={this.handleCreate}
                        disabled={!enableSubmitButton}
                        btnClass='btn-primary'
                        saving={this.props.creatingSubscriptionTemplate || this.props.selectedSubscriptionTemplate ? this.state.submittingTemplate : this.state.submitting}
                        defaultMessage={saveSubscriptionButtonText}
                        savingMessage={tr('Сохраняем…')}
                    />
                </Modal.Footer>
            </form>
        );
    }
}

const getStyle = (theme: any): any => ({
    modalBody: {
        padding: '2em 0',
        color: theme.centerChannelColor,
        backgroundColor: theme.centerChannelBg,
    },
    modalFooter: {
        padding: '2rem 15px',
    },
    descriptionArea: {
        height: 'auto',
        width: '100%',
        color: '#000',
    },
});
