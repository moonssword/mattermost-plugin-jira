// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';

import {Theme} from 'mattermost-redux/selectors/entities/preferences';

import {RHSErrorCode} from 'types/rhs';
import {
    RHSAssignTarget,
    RHSCardState,
    RHSTransition,
    RHSTransitionScreen,
    RHSTransitionValues,
    RHSUser,
    isSameRHSUser,
} from 'types/rhs_issue';
import {isRHSIssueOverdue} from 'utils/rhs_group';
import {formatRHSRelativeTime, formatRHSShortDate} from 'utils/rhs_time';

import RHSIssueTypeIcon from '../rhs_issue_type_icon';
import RHSMarkdown from '../rhs_markdown';
import {RHSSkeletonCard} from '../rhs_skeleton';
import {RHSErrorState} from '../rhs_states';
import {RHS_STRINGS} from '../rhs_strings';

import AssigneeField, {RHSUserLabel} from './assignee_field';
import {CommentComposer, CommentList} from './comments';
import StatusMenu from './status_menu';
import TransitionForm from './transition_form';

type Result = Promise<{data?: unknown; error?: unknown}>;

export type Props = {
    card: RHSCardState;
    channelId: string;
    instanceID: string;
    theme: Theme;
    closeRHSIssue: () => void;
    fetchRHSIssueCard: (key: string) => Result;
    transitionRHSCard: (transitionID: string, values?: RHSTransitionValues) => Result;
    loadRHSCardTransitionScreen: (transitionID: string) => Promise<{data?: RHSTransitionScreen; error?: unknown}>;
    clearRHSCardTransitionRequest: () => unknown;
    assignRHSCard: (target: RHSAssignTarget) => Result;
    commentRHSCard: (text: string) => Result;
    uploadRHSCardFile?: (file: File) => Result;
    shareRHSCard: (channelId: string) => Result;
    searchRHSCardAssignees: (query: string) => Promise<{data?: RHSUser[]; error?: unknown}>;
};

export function cardErrorText(code: RHSErrorCode | null, message: string): string {
    switch (code) {
    case 'not_found':
        return RHS_STRINGS.cardNotFound;
    case 'forbidden':
        return RHS_STRINGS.cardForbidden;
    case 'rate_limited':
        return RHS_STRINGS.rateLimited;
    case 'jira_rejected':
        return message ? RHS_STRINGS.cardActionFailed + ': ' + message : RHS_STRINGS.cardActionFailed;
    default:
        return RHS_STRINGS.cardActionFailed;
    }
}

function Field(props: {label: string; children: React.ReactNode; testId?: string}): JSX.Element {
    return (
        <>
            <dt>{props.label}</dt>
            <dd data-testid={props.testId}>{props.children}</dd>
        </>
    );
}

const SHARED_NOTE_MS = 4000;

// IssueCard replaces /jira view, transition, assign and unassign: it shows
// one issue over the section list with a "back" button.
export default function IssueCard(props: Props): JSX.Element {
    const {card} = props;
    const data = card.data;
    const [nowMs] = useState(() => Date.now());
    const [shared, setShared] = useState(false);
    const sharedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const backButton = useRef<HTMLButtonElement>(null);
    const [screenForm, setScreenForm] = useState<{transition: RHSTransition; screen: RHSTransitionScreen} | null>(null);
    const [checkingScreen, setCheckingScreen] = useState(false);

    useEffect(() => {
        backButton.current?.focus();
        return () => {
            if (sharedTimer.current) {
                clearTimeout(sharedTimer.current);
            }
        };
    }, []);

    // A transition with a screen opens its form; without one it runs at once.
    // If the screen cannot be read, Jira still explains a refused transition.
    const startTransition = async (id: string) => {
        const transition = data?.transitions.find((t) => t.id === id);
        setCheckingScreen(true);
        const {data: screen} = await props.loadRHSCardTransitionScreen(id);
        setCheckingScreen(false);
        if (transition && screen && Object.keys(screen.fields).length > 0) {
            setScreenForm({transition, screen});
            return;
        }
        props.transitionRHSCard(id);
    };

    useEffect(() => {
        if (card.requestedTransition && data) {
            props.clearRHSCardTransitionRequest();
            startTransition(card.requestedTransition);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [card.requestedTransition, data]);

    const submitScreen = async (values: RHSTransitionValues) => {
        if (!screenForm) {
            return;
        }
        const {error} = await props.transitionRHSCard(screenForm.transition.id, values);
        if (!error) {
            setScreenForm(null);
        }
    };

    const onShare = async () => {
        const result = await props.shareRHSCard(props.channelId);
        if (!result.error) {
            setShared(true);
            sharedTimer.current = setTimeout(() => setShared(false), SHARED_NOTE_MS);
        }
    };

    let body: React.ReactNode;
    if (data) {
        body = null;
    } else if (card.loading) {
        body = <RHSSkeletonCard/>;
    } else if (card.error === 'not_found' || card.error === 'forbidden') {
        body = (
            <div
                className='jira-rhs-state'
                data-testid='rhs-card-error'
            >
                <p>{cardErrorText(card.error, card.errorMessage)}</p>
            </div>
        );
    } else {
        body = <RHSErrorState onRetry={() => props.fetchRHSIssueCard(card.key)}/>;
    }
    if (data) {
        const assignedToMe = isSameRHSUser(data.assignee, data.me);
        const overdue = isRHSIssueOverdue(data, nowMs);
        body = (
            <div
                className='jira-rhs-card-body'
                data-testid='rhs-card'
            >
                <div className='jira-rhs-card-kind'>
                    <RHSIssueTypeIcon
                        issueType={data.issueType}
                        iconUrl={data.issueTypeIconUrl}
                    />
                    <span>{(data.projectName || data.project) + ' · ' + data.issueType}</span>
                </div>
                <h3 className='jira-rhs-card-summary'>{data.summary}</h3>

                <div className='jira-rhs-card-actions'>
                    <StatusMenu
                        status={data.status}
                        transitions={data.transitions}
                        busy={card.pending === 'transition' || checkingScreen}
                        onTransition={startTransition}
                    />
                    {!assignedToMe && (
                        <button
                            type='button'
                            className='btn btn-tertiary btn-sm'
                            data-testid='rhs-card-assign-me'
                            disabled={card.pending !== null}
                            onClick={() => props.assignRHSCard({me: true})}
                        >
                            {RHS_STRINGS.assignToMe}
                        </button>
                    )}
                    {props.channelId && (
                        <button
                            type='button'
                            className='btn btn-tertiary btn-sm'
                            data-testid='rhs-card-share'
                            title={RHS_STRINGS.shareToChannel}
                            aria-label={RHS_STRINGS.shareToChannel}
                            disabled={card.pending !== null}
                            onClick={onShare}
                        >
                            <i
                                className='icon icon-share-variant-outline'
                                aria-hidden={true}
                            />
                            {RHS_STRINGS.shareShort}
                        </button>
                    )}
                </div>

                {shared && (
                    <div
                        className='jira-rhs-card-note'
                        role='status'
                    >
                        {RHS_STRINGS.shared}
                    </div>
                )}
                {card.actionError && (
                    <div
                        className='jira-rhs-card-alert'
                        role='alert'
                        data-testid='rhs-card-action-error'
                    >
                        {cardErrorText(card.actionError, card.actionErrorMessage)}
                    </div>
                )}

                <dl className='jira-rhs-card-fields'>
                    <Field
                        label={RHS_STRINGS.fieldAssignee}
                        testId='rhs-card-assignee'
                    >
                        <AssigneeField
                            assignee={data.assignee}
                            busy={card.pending === 'assign'}
                            onAssign={(target) => props.assignRHSCard(target)}
                            searchUsers={props.searchRHSCardAssignees}
                        />
                    </Field>
                    <Field label={RHS_STRINGS.fieldReporter}>
                        <RHSUserLabel user={data.reporter}/>
                    </Field>
                    {data.priority && (
                        <Field label={RHS_STRINGS.fieldPriority}>
                            <span className='jira-rhs-user'>
                                {data.priorityIconUrl && (
                                    <img
                                        src={data.priorityIconUrl}
                                        alt=''
                                        width={14}
                                        height={14}
                                    />
                                )}
                                {data.priority}
                            </span>
                        </Field>
                    )}
                    {data.dueDate && (
                        <Field label={RHS_STRINGS.fieldDue}>
                            <span className={overdue ? 'jira-rhs-issue-time--overdue' : ''}>
                                {formatRHSShortDate(Date.parse(data.dueDate + 'T12:00:00Z'), nowMs) + (overdue ? ', ' + RHS_STRINGS.overdue : '')}
                            </span>
                        </Field>
                    )}
                    {data.labels.length > 0 && (
                        <Field label={RHS_STRINGS.fieldLabels}>
                            <span className='jira-rhs-labels'>
                                {data.labels.map((label) => (
                                    <span
                                        key={label}
                                        className='jira-rhs-label'
                                    >
                                        {label}
                                    </span>
                                ))}
                            </span>
                        </Field>
                    )}
                    <Field label={RHS_STRINGS.fieldUpdated}>
                        {formatRHSRelativeTime(data.updated, nowMs)}
                    </Field>
                </dl>

                <section className='jira-rhs-card-section'>
                    <h4>{RHS_STRINGS.description}</h4>
                    {data.description ? (
                        <RHSMarkdown text={data.description}/>
                    ) : (
                        <p className='jira-rhs-muted'>{RHS_STRINGS.noDescription}</p>
                    )}
                </section>

                {data.attachments && data.attachments.length > 0 && (
                    <section
                        className='jira-rhs-card-section'
                        data-testid='rhs-card-attachments'
                    >
                        <h4>{RHS_STRINGS.attachments + ' · ' + data.attachments.length}</h4>
                        <div className='jira-rhs-attachments'>
                            {data.attachments.map((file) => (
                                <a
                                    key={file.id}
                                    className={file.image ? 'jira-rhs-attachment jira-rhs-attachment--image' : 'jira-rhs-attachment'}
                                    href={file.url}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    title={file.name}
                                >
                                    {file.image ? (
                                        <img
                                            src={file.url}
                                            alt={file.name}
                                            loading='lazy'
                                        />
                                    ) : (
                                        <>
                                            <i
                                                className='icon icon-paperclip'
                                                aria-hidden={true}
                                            />
                                            <span>{file.name}</span>
                                        </>
                                    )}
                                </a>
                            ))}
                        </div>
                    </section>
                )}

                <section className='jira-rhs-card-section'>
                    <h4>{RHS_STRINGS.comments + (data.commentsTotal ? ' · ' + data.commentsTotal : '')}</h4>
                    <CommentList
                        comments={data.comments}
                        total={data.commentsTotal}
                        nowMs={nowMs}
                    />
                </section>
            </div>
        );
    }

    if (data && screenForm) {
        body = (
            <TransitionForm
                transition={screenForm.transition}
                fields={screenForm.screen.fields}
                instanceID={props.instanceID}
                projectKey={data.project}
                browseUrl={data.browseUrl}
                theme={props.theme}
                busy={card.pending === 'transition'}
                error={card.actionError ? cardErrorText(card.actionError, card.actionErrorMessage) : ''}
                onSubmit={submitScreen}
                onCancel={() => setScreenForm(null)}
            />
        );
    }

    return (
        <div
            className='jira-rhs-card'
            onKeyDown={(event) => {
                if (event.key !== 'Escape' || event.defaultPrevented) {
                    return;
                }
                if (screenForm) {
                    setScreenForm(null);
                } else {
                    props.closeRHSIssue();
                }
            }}
        >
            <div className='jira-rhs-card-top'>
                <button
                    type='button'
                    className='jira-rhs-icon-button'
                    aria-label={RHS_STRINGS.back}
                    title={RHS_STRINGS.back}
                    data-testid='rhs-card-back'
                    ref={backButton}
                    onClick={props.closeRHSIssue}
                >
                    <i
                        className='icon icon-arrow-left'
                        aria-hidden={true}
                    />
                </button>
                <span className='jira-rhs-card-key'>{card.key}</span>
                {data && (
                    <a
                        className='jira-rhs-icon-button jira-rhs-card-open'
                        href={data.browseUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        aria-label={RHS_STRINGS.openInJira}
                        title={RHS_STRINGS.openInJira}
                        data-testid='rhs-card-open-jira'
                    >
                        <i
                            className='icon icon-open-in-new'
                            aria-hidden={true}
                        />
                    </a>
                )}
            </div>
            {body}
            {data && !screenForm && (
                <CommentComposer
                    busy={card.pending !== null}
                    onSend={props.commentRHSCard}
                    onUpload={props.uploadRHSCardFile}
                />
            )}
        </div>
    );
}
