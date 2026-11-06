// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {RHSAttachment} from 'types/rhs_issue';
import {formatRHSRelativeTime} from 'utils/rhs_time';

import {RHS_STRINGS} from '../rhs_strings';
import {
    RHSViewerProbe,
    isRHSViewable,
    openRHSViewer,
    rhsFileExtension,
} from '../rhs_viewer';

// Most issues fit: the block should not push the comments far down.
export const RHS_ATTACHMENTS_COLLAPSED = 6;

export function formatRHSFileSize(bytes?: number): string {
    if (!bytes || bytes < 0) {
        return '';
    }
    if (bytes < 1024) {
        return bytes + ' ' + RHS_STRINGS.sizeBytes;
    }
    if (bytes < 1024 * 1024) {
        return Math.round(bytes / 1024) + ' ' + RHS_STRINGS.sizeKilobytes;
    }
    const megabytes = bytes / (1024 * 1024);
    return (megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)) + ' ' + RHS_STRINGS.sizeMegabytes;
}

// Files the viewer can show go there, with arrows between them; the rest, or
// anything if the viewer is unavailable, follows the link.
function openAttachment(event: React.MouseEvent, id: string, attachments: RHSAttachment[]) {
    const viewable = attachments.filter((file) => isRHSViewable(file.name));
    const index = viewable.findIndex((file) => file.id === id);
    if (index >= 0 && openRHSViewer(viewable, index)) {
        event.preventDefault();
    }
}

export default function AttachmentTiles(props: {attachments: RHSAttachment[]; nowMs: number}): JSX.Element | null {
    const {attachments} = props;
    const [expanded, setExpanded] = useState(false);
    const [broken, setBroken] = useState<Set<string>>(() => new Set());

    if (attachments.length === 0) {
        return null;
    }
    const collapsible = attachments.length > RHS_ATTACHMENTS_COLLAPSED;
    const shown = collapsible && !expanded ? attachments.slice(0, RHS_ATTACHMENTS_COLLAPSED) : attachments;

    return (
        <section
            className='jira-rhs-card-section'
            data-testid='rhs-card-attachments'
        >
            <h4>{RHS_STRINGS.attachments + ' · ' + attachments.length}</h4>
            <RHSViewerProbe pictureUrl={attachments[0].url.split('/api/v2/')[0] + '/public/rhs-viewer-probe.png'}/>
            <div className='jira-rhs-tiles'>
                {shown.map((file) => {
                    const size = formatRHSFileSize(file.size);
                    const when = file.created ? formatRHSRelativeTime(file.created, props.nowMs) : '';
                    return (
                        <a
                            key={file.id}
                            className='jira-rhs-tile'
                            href={file.url}
                            target='_blank'
                            rel='noopener noreferrer'
                            title={[file.name, size, when].filter(Boolean).join(' · ')}
                            data-testid='rhs-attachment-tile'
                            onClick={(event) => openAttachment(event, file.id, attachments)}
                        >
                            <span className='jira-rhs-tile-preview'>
                                {file.image && !broken.has(file.id) ? (
                                    <img
                                        src={file.url}
                                        alt=''
                                        loading='lazy'
                                        onError={() => setBroken((current) => new Set(current).add(file.id))}
                                    />
                                ) : (
                                    <span className='jira-rhs-tile-type'>{rhsFileExtension(file.name).slice(0, 4).toUpperCase() || RHS_STRINGS.fileNoType}</span>
                                )}
                            </span>
                            <span className='jira-rhs-tile-name'>{file.name}</span>
                            <span className='jira-rhs-tile-size'>{size || ' '}</span>
                        </a>
                    );
                })}
            </div>
            {collapsible && (
                <button
                    type='button'
                    className='jira-rhs-link-button jira-rhs-tiles-more'
                    data-testid='rhs-attachments-toggle'
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? RHS_STRINGS.attachmentsCollapse : RHS_STRINGS.attachmentsShowAll.replace('{count}', String(attachments.length))}
                </button>
            )}
        </section>
    );
}
