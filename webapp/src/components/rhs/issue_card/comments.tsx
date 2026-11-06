// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';

import {RHSComment} from 'types/rhs_issue';
import {
    rhsClipboardFiles,
    rhsFileReference,
    rhsInsertAtCursor,
    rhsNamedFile,
    rhsPastedFileName,
} from 'utils/rhs_files';
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
                        <RHSAvatar
                            name={comment.author.displayName}
                            url={comment.author.avatarUrl}
                        />
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
    onUpload?: (file: File) => Promise<{data?: unknown; error?: unknown}>;
};

function uploadErrorText(error: unknown): string {
    return (error as {errorCode?: string}).errorCode === 'file_too_large' ? RHS_STRINGS.filesTooLarge : RHS_STRINGS.filesFailed;
}

// Comment box: Ctrl+Enter or Cmd+Enter sends; the text is kept on failure.
// A pasted screenshot or a chosen file goes to the issue at once, and the text
// gets a reference to it.
export function CommentComposer(props: ComposerProps): JSX.Element {
    const [text, setText] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const input = useRef<HTMLTextAreaElement>(null);
    const picker = useRef<HTMLInputElement>(null);

    const send = async () => {
        const body = text.trim();
        if (!body || props.busy || uploading) {
            return;
        }
        const result = await props.onSend(body);
        if (!result.error) {
            setText('');
        }
    };

    const upload = async (files: File[]) => {
        const onUpload = props.onUpload;
        if (!onUpload || files.length === 0) {
            return;
        }
        setUploading(true);
        setUploadError('');
        const now = new Date();
        const start = input.current ? input.current.selectionStart : text.length;
        const end = input.current ? input.current.selectionEnd : text.length;
        const references: string[] = [];
        for (const [index, file] of files.entries()) {
            const name = rhsPastedFileName(file, now, index);

            // eslint-disable-next-line no-await-in-loop
            const {error} = await onUpload(rhsNamedFile(file, name));
            if (error) {
                setUploadError(uploadErrorText(error));
            } else {
                references.push(rhsFileReference(name));
            }
        }
        setUploading(false);
        if (references.length > 0) {
            setText((current) => rhsInsertAtCursor(current, start, end, references.join('\n')).text);
            input.current?.focus();
        }
    };

    return (
        <div className='jira-rhs-composer'>
            <textarea
                ref={input}
                className='jira-rhs-composer-input'
                rows={2}
                placeholder={RHS_STRINGS.commentPlaceholder}
                aria-label={RHS_STRINGS.commentPlaceholder}
                data-testid='rhs-card-comment-input'
                value={text}
                onChange={(event) => setText(event.target.value)}
                onPaste={(event) => {
                    const files = props.onUpload ? rhsClipboardFiles(event.clipboardData) : [];
                    if (files.length > 0) {
                        event.preventDefault();
                        upload(files);
                    }
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault();
                        send();
                    }
                }}
            />
            {uploadError && (
                <div
                    className='jira-rhs-small jira-rhs-composer-error'
                    role='alert'
                >
                    {uploadError}
                </div>
            )}
            <div className='jira-rhs-composer-foot'>
                {props.onUpload && (
                    <>
                        <input
                            ref={picker}
                            type='file'
                            multiple={true}
                            style={{display: 'none'}}
                            data-testid='rhs-card-comment-file'
                            onChange={(event) => {
                                upload(Array.from(event.target.files || []));
                                event.target.value = '';
                            }}
                        />
                        <button
                            type='button'
                            className='jira-rhs-icon-button'
                            aria-label={RHS_STRINGS.filesAttach}
                            title={RHS_STRINGS.filesAttach}
                            data-testid='rhs-card-comment-attach'
                            disabled={uploading}
                            onClick={() => picker.current?.click()}
                        >
                            <i
                                className='icon icon-paperclip'
                                aria-hidden={true}
                            />
                        </button>
                    </>
                )}
                <span className='jira-rhs-muted jira-rhs-small'>{uploading ? RHS_STRINGS.filesUploading : RHS_STRINGS.commentHint}</span>
                <button
                    type='button'
                    className='btn btn-primary btn-sm'
                    data-testid='rhs-card-comment-send'
                    disabled={props.busy || uploading || !text.trim()}
                    onClick={send}
                >
                    {RHS_STRINGS.send}
                </button>
            </div>
        </div>
    );
}
