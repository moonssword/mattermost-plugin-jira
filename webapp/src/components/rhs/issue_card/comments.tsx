// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {RHSComment} from 'types/rhs_issue';
import {formatRHSRelativeTime} from 'utils/rhs_time';

import RHSAvatar from '../rhs_avatar';
import RHSMarkdown from '../rhs_markdown';
import {RHS_STRINGS} from '../rhs_strings';

export function CommentList(props: {comments: RHSComment[]; total: number; nowMs: number}): JSX.Element {
    if (props.comments.length === 0) {
        return <p className='jira-rhs-muted'>{RHS_STRINGS.noComments}</p>;
    }
    return (
        <>
            {props.total > props.comments.length && (
                <p
                    className='jira-rhs-muted jira-rhs-small'
                    data-testid='rhs-card-comments-older'
                >
                    {RHS_STRINGS.commentsOlder.replace('{shown}', String(props.comments.length)).replace('{total}', String(props.total))}
                </p>
            )}
            <ol className='jira-rhs-comments'>
                {props.comments.map((comment) => (
                    <li
                        key={comment.id}
                        className='jira-rhs-comment'
                    >
                        <RHSAvatar name={comment.author.displayName}/>
                        <div className='jira-rhs-comment-main'>
                            <div className='jira-rhs-comment-head'>
                                <b>{comment.author.displayName}</b>
                                <span className='jira-rhs-muted jira-rhs-small'>{formatRHSRelativeTime(comment.created, props.nowMs)}</span>
                            </div>
                            <RHSMarkdown text={comment.body}/>
                        </div>
                    </li>
                ))}
            </ol>
        </>
    );
}

export type ComposerProps = {
    busy: boolean;
    onSend: (text: string) => Promise<{data?: unknown; error?: unknown}>;
};

// Comment box: Ctrl+Enter or Cmd+Enter sends; the text is kept on failure.
export function CommentComposer(props: ComposerProps): JSX.Element {
    const [text, setText] = useState('');

    const send = async () => {
        const body = text.trim();
        if (!body || props.busy) {
            return;
        }
        const result = await props.onSend(body);
        if (!result.error) {
            setText('');
        }
    };

    return (
        <div className='jira-rhs-composer'>
            <textarea
                className='jira-rhs-composer-input'
                rows={2}
                placeholder={RHS_STRINGS.commentPlaceholder}
                aria-label={RHS_STRINGS.commentPlaceholder}
                data-testid='rhs-card-comment-input'
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault();
                        send();
                    }
                }}
            />
            <div className='jira-rhs-composer-foot'>
                <span className='jira-rhs-muted jira-rhs-small'>{RHS_STRINGS.commentHint}</span>
                <button
                    type='button'
                    className='btn btn-primary btn-sm'
                    data-testid='rhs-card-comment-send'
                    disabled={props.busy || !text.trim()}
                    onClick={send}
                >
                    {RHS_STRINGS.send}
                </button>
            </div>
        </div>
    );
}
