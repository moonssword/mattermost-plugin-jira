// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useRef} from 'react';

import {RHSAttachment} from 'types/rhs_issue';

// Opening Jira attachments in Mattermost's own file viewer.
//
// Plugins have no API for it, so this relies on the host's internals: the
// message renderer opens the viewer when a picture is clicked, which puts the
// viewer component in the store. A hidden picture gives that component, and it
// then opens with our files. If anything here changes in a new Mattermost,
// openRHSViewer returns false and the caller opens the file as a usual link.

const VIEWER_MODAL_ID = 'file_preview_modal';
const OPEN_MODAL = 'MODAL_OPEN';
const CLOSE_MODAL = 'MODAL_CLOSE';
const VIEWER_BODY_CLASS = 'jira-rhs-viewer-open';
const ATTACHMENT_ROUTE = '/rhs/attachment';

const VIEWABLE = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'pdf',
    'txt', 'log', 'md', 'json', 'xml', 'yaml', 'yml', 'ini', 'conf', 'sql',
    'sh', 'py', 'go', 'js', 'ts', 'tsx', 'jsx', 'java', 'kt', 'php', 'rb', 'cs', 'cpp', 'c', 'h', 'css', 'scss', 'html',
]);

type HostStore = {
    getState: () => {views?: {modals?: {modalState?: {[id: string]: {open?: boolean; dialogType?: unknown; dialogProps?: {fileInfos?: Array<{link?: string}>}} | undefined}}}};
    dispatch: (action: object) => unknown;
    subscribe: (listener: () => void) => () => void;
};

type PostUtils = {
    formatText: (text: string, options?: object) => string;
    messageHtmlToComponent: (html: string, options?: object) => React.ReactNode;
};

function hostStore(): HostStore | null {
    const store = (window as unknown as {store?: HostStore}).store;
    return store && typeof store.getState === 'function' && typeof store.dispatch === 'function' ? store : null;
}

function viewerState(store: HostStore) {
    return store.getState().views?.modals?.modalState?.[VIEWER_MODAL_ID];
}

export function rhsFileExtension(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function isRHSViewable(name: string): boolean {
    return VIEWABLE.has(rhsFileExtension(name));
}

// The file name is the last parameter of the plugin's attachment addresses.
export function rhsAttachmentNameFromURL(url: string): string {
    const match = url.includes(ATTACHMENT_ROUTE) ? url.match(/[?&]name=([^&#]*)$/) : null;
    if (!match) {
        return '';
    }
    try {
        return decodeURIComponent(match[1].replace(/\+/g, ' '));
    } catch (error) {
        return '';
    }
}

let probe: HTMLElement | null = null;
let viewerComponent: unknown = null;

// The click happens inside the user's click, so React renders only the final
// state and the hidden picture never shows up in the viewer.
function findViewerComponent(store: HostStore): unknown {
    if (viewerComponent) {
        return viewerComponent;
    }
    const image = probe?.querySelector('img');
    if (!image || !image.complete || !image.naturalWidth) {
        return null;
    }
    image.click();
    viewerComponent = viewerState(store)?.dialogType || null;
    return viewerComponent;
}

// openRHSViewer returns false when the viewer is not available.
export function openRHSViewer(files: Array<Pick<RHSAttachment, 'name' | 'url'>>, startIndex = 0): boolean {
    const store = hostStore();
    if (!store || files.length === 0) {
        return false;
    }
    try {
        const dialogType = findViewerComponent(store);
        if (!dialogType) {
            return false;
        }
        store.dispatch({
            type: OPEN_MODAL,
            modalId: VIEWER_MODAL_ID,
            dialogType,
            dialogProps: {
                startIndex,
                fileInfos: files.map((file) => ({
                    has_preview_image: false,
                    link: file.url,
                    extension: rhsFileExtension(file.name),
                    name: file.name,
                })),
            },
        });
        return true;
    } catch (error) {
        store.dispatch({type: CLOSE_MODAL, modalId: VIEWER_MODAL_ID});
        return false;
    }
}

// handleRHSAttachmentLink opens a link to an attachment in the viewer, for
// clicks in rendered text.
export function handleRHSAttachmentLink(event: React.MouseEvent): void {
    const link = (event.target as HTMLElement).closest?.('a');
    const href = link?.getAttribute('href') || '';
    const name = rhsAttachmentNameFromURL(href);
    const url = href.replace(/^https?:\/\/[^/]+/, '');
    if (name && isRHSViewable(name) && openRHSViewer([{name, url}])) {
        event.preventDefault();
        event.stopPropagation();
    }
}

// RHSViewerProbe keeps the hidden picture ready, and hides the "Someone" author
// line the viewer shows for files that have no Mattermost post.
export function RHSViewerProbe(props: {pictureUrl: string}): JSX.Element | null {
    const box = useRef<HTMLDivElement>(null);

    const picture = useMemo(() => {
        const utils = (window as unknown as {PostUtils?: PostUtils}).PostUtils;
        if (!utils || viewerComponent) {
            return null;
        }
        const html = utils.formatText('![](' + props.pictureUrl + ')', {markdown: true, singleline: false, atMentions: false});
        return utils.messageHtmlToComponent(html, {mentions: false, emoji: false, images: true});
    }, [props.pictureUrl]);

    useEffect(() => {
        probe = box.current;
        return () => {
            probe = null;
        };
    });

    useEffect(() => {
        const store = hostStore();
        if (!store) {
            return () => null;
        }
        const update = () => {
            const state = viewerState(store);
            const ours = Boolean(state?.open) && Boolean(state?.dialogProps?.fileInfos?.[0]?.link?.includes(ATTACHMENT_ROUTE));
            document.body.classList.toggle(VIEWER_BODY_CLASS, ours);
        };
        update();
        const unsubscribe = store.subscribe(update);
        return () => {
            unsubscribe();
            document.body.classList.remove(VIEWER_BODY_CLASS);
        };
    }, []);

    if (!picture) {
        return null;
    }
    return (
        <div
            ref={box}
            className='jira-rhs-viewer-probe'
            aria-hidden={true}
        >
            {picture}
        </div>
    );
}
