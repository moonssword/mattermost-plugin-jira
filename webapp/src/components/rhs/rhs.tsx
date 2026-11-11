// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';

import {Instance} from 'types/model';
import {RHSErrorCode, RHSViewState} from 'types/rhs';
import {RHSSectionID} from 'types/rhs_nav';
import {setRHSMounted} from 'utils/rhs_controller';

import AttachView from './attach_view';
import IssueCard from './issue_card';
import {RHSConnectScreen, RHSNoInstanceScreen} from './rhs_connect_screen';
import RHSPanelHeader from './rhs_panel_header';
import RHSSectionTabs, {RHS_SECTION_PANEL_ID, rhsSectionDomId} from './rhs_section_tabs';
import {RHS_TAB_SECTIONS, findRHSSection} from './rhs_sections';
import {RHSSkeletonPanel} from './rhs_skeleton';
import {RHS_STRINGS} from './rhs_strings';
import {RHS_SEARCH_EVENT} from './sections/my_issues/my_issues';
import SettingsView from './settings_view';

import './rhs.scss';
import './rhs_cards.scss';

export type Props = {
    uiLanguage?: string;
    uiStyle?: string;
    installedInstances: Instance[];
    connectedInstances: Instance[];
    activeInstanceID: string;
    section: RHSSectionID;
    issueKey: string;
    attachPostId: string;
    settingsOpen: boolean;
    issuesError: RHSErrorCode | null;
    isAdmin: boolean;
    channelId: string;
    teamId: string;

    // Counter of the "Мои" tab; null while searching or unknown.
    myIssuesCount: number | null;
    getConnected: () => Promise<unknown>;
    restoreRHSViewState: () => {data: RHSViewState | null};
    setRHSSection: (section: RHSSectionID) => void;
    selectRHSInstance: (instanceID: string) => void;
    openRHSSettings: () => void;
    handleConnectFlow: (instanceID?: string) => void;
    startJiraSetupWizard: (channelId: string, teamId: string) => Promise<{data?: unknown; error?: unknown}>;
};

export type RHSScreen = 'loading' | 'no_instance' | 'connect' | 'main';

export function rhsScreen(args: {
    booting: boolean;
    installedCount: number;
    connectedCount: number;
    issuesError: RHSErrorCode | null;
}): RHSScreen {
    if (args.booting) {
        return 'loading';
    }
    if (args.installedCount === 0) {
        return 'no_instance';
    }
    if (args.connectedCount === 0 || args.issuesError === 'not_connected') {
        return 'connect';
    }
    return 'main';
}

// Instances the user can still connect; all installed ones when the stored
// connection was rejected by Jira.
function connectableInstances(installed: Instance[], connected: Instance[], issuesError: RHSErrorCode | null): Instance[] {
    if (issuesError === 'not_connected') {
        return installed;
    }
    const connectedIDs = new Set(connected.map((instance) => instance.instance_id));
    const rest = installed.filter((instance) => !connectedIDs.has(instance.instance_id));
    return rest.length > 0 ? rest : installed;
}

// How long after the panel opens it takes the focus.
export const RHS_FOCUS_DELAY_MS = 100;

function isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el || !el.tagName) {
        return false;
    }
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable;
}

// Shell of the Jira RHS: loads the connection state, then shows either a
// first-run screen or the panel header, section tabs and the active section.
export default function Rhs(props: Props): JSX.Element {
    const {
        installedInstances,
        connectedInstances,
        activeInstanceID,
        section,
        issuesError,
        getConnected,
        restoreRHSViewState,
    } = props;

    const [booting, setBooting] = useState(true);

    // The tab to return to from a full-panel section such as "Создать".
    const lastTab = useRef<RHSSectionID>('my_issues');

    // The panel takes the focus when it opens, unless the user is typing
    // somewhere, so its shortcuts work at once; a click on any part of it
    // keeps the focus inside (tabIndex -1), not only a click on a button.
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        // After the click that opened the panel: Mattermost leaves the focus
        // on the App Bar button once that click is over.
        const timer = setTimeout(() => {
            const active = document.activeElement;
            if (root.current && !isTypingTarget(active) && !root.current.contains(active)) {
                root.current.focus({preventScroll: true});
            }
        }, RHS_FOCUS_DELAY_MS);
        return () => clearTimeout(timer);
    }, []);

    // Going back from the card, the settings or a form removes the button
    // that had the focus, and the browser drops it to the page: Mattermost
    // then sends the keys to the message box. The panel takes it back.
    useEffect(() => {
        const timer = setTimeout(() => {
            const active = document.activeElement;
            if (root.current && (!active || active === document.body)) {
                root.current.focus({preventScroll: true});
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [section, props.issueKey, props.attachPostId, props.settingsOpen]);
    if (findRHSSection(section).tab !== false) {
        lastTab.current = section;
    }

    // Live updates refresh the list only while the panel is on screen.
    // Select menus render in <body>, outside the styled panel.
    useEffect(() => {
        if (props.uiStyle !== 'cards') {
            return () => {
                // nothing to undo
            };
        }
        document.body.style.setProperty('--jira-rhs-menu-radius', '10px');
        return () => document.body.style.removeProperty('--jira-rhs-menu-radius');
    }, [props.uiStyle]);

    useEffect(() => {
        setRHSMounted(true);
        return () => setRHSMounted(false);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const boot = async () => {
            await getConnected();
            if (cancelled) {
                return;
            }
            restoreRHSViewState();
            setBooting(false);
        };
        boot();
        return () => {
            cancelled = true;
        };

    // Boot once on mount: callback identities must not re-run the connect check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const screen = rhsScreen({
        booting,
        installedCount: installedInstances.length,
        connectedCount: connectedInstances.length,
        issuesError,
    });

    let content: React.ReactNode;
    switch (screen) {
    case 'loading':
        content = <RHSSkeletonPanel/>;
        break;
    case 'no_instance':
        content = (
            <RHSNoInstanceScreen
                isAdmin={props.isAdmin}
                onRunSetup={async () => {
                    const result = await props.startJiraSetupWizard(props.channelId, props.teamId);
                    return !result.error;
                }}
            />
        );
        break;
    case 'connect':
        content = (
            <RHSConnectScreen
                instances={connectableInstances(installedInstances, connectedInstances, issuesError)}
                onConnect={(instanceID) => props.handleConnectFlow(instanceID)}
            />
        );
        break;
    case 'main': {
        const active = findRHSSection(section);
        const Section = active.component;
        const fullPanel = active.tab === false;

        // Settings, attach and the card are views over the sections; at most
        // one shows, settings first. The sections stay mounted to keep the
        // list and its scroll position for "back".
        const settingsOpen = props.settingsOpen;
        const attachOpen = !settingsOpen && Boolean(props.attachPostId);
        const cardOpen = !settingsOpen && !attachOpen && Boolean(props.issueKey);
        const overlay = cardOpen || attachOpen || settingsOpen;
        content = (
            <>
                {settingsOpen && <SettingsView/>}
                {attachOpen && <AttachView/>}
                {cardOpen && <IssueCard/>}
                {fullPanel ? (
                    <div
                        className='jira-rhs-main'
                        hidden={overlay}
                    >
                        <Section
                            instanceID={activeInstanceID}
                            onBack={() => props.setRHSSection(lastTab.current)}
                        />
                    </div>
                ) : (
                    <div
                        className='jira-rhs-main'
                        hidden={overlay}
                    >
                        <RHSPanelHeader
                            instances={connectedInstances}
                            activeInstanceID={activeInstanceID}
                            onInstanceChange={props.selectRHSInstance}
                            actions={(
                                <button
                                    type='button'
                                    className='jira-rhs-icon-button'
                                    aria-label={RHS_STRINGS.settingsOpen}
                                    title={RHS_STRINGS.settingsOpen}
                                    data-testid='rhs-open-settings'
                                    onClick={props.openRHSSettings}
                                >
                                    <i
                                        className='icon icon-cog-outline'
                                        aria-hidden={true}
                                    />
                                </button>
                            )}
                        />
                        <RHSSectionTabs
                            sections={RHS_TAB_SECTIONS}
                            selected={active.id}
                            onSelect={props.setRHSSection}
                            counts={{my_issues: props.myIssuesCount}}
                        />
                        <div
                            className='jira-rhs-section'
                            role='tabpanel'
                            id={RHS_SECTION_PANEL_ID}
                            aria-labelledby={rhsSectionDomId(active.id)}
                        >
                            <Section instanceID={activeInstanceID}/>
                        </div>
                        <button
                            type='button'
                            className='jira-rhs-qadd'
                            data-testid='rhs-quick-create'
                            onClick={() => props.setRHSSection('create')}
                        >
                            <i
                                className='icon icon-plus'
                                aria-hidden={true}
                            />
                            <span>{RHS_STRINGS.quickCreate}</span>
                            <span className='jira-rhs-kbd'>{RHS_STRINGS.quickCreateKey}</span>
                        </button>
                    </div>
                )}
            </>
        );
        break;
    }
    default: {
        const exhaustive: never = screen;
        content = exhaustive;
    }
    }

    // Shortcuts while focus is in the panel but not in a text field:
    // C opens the create form, "/" the search.
    const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (screen !== 'main' || props.settingsOpen || props.attachPostId || props.issueKey) {
            return;
        }
        if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) {
            return;
        }

        // The physical key, so C works in any keyboard layout.
        const key = event.key.toLowerCase();
        if ((key === 'c' || key === 'с' || event.code === 'KeyC') && section !== 'create') {
            event.preventDefault();
            props.setRHSSection('create');
        } else if (key === '/' && findRHSSection(section).tab !== false) {
            event.preventDefault();
            if (section !== 'my_issues') {
                props.setRHSSection('my_issues');
            }
            setTimeout(() => window.dispatchEvent(new Event(RHS_SEARCH_EVENT)), 0);
        }
    };

    return (
        <div
            ref={root}
            key={props.uiLanguage}
            className='jira-rhs'
            data-testid='jira-rhs'
            data-style={props.uiStyle}
            tabIndex={-1}
            onKeyDown={onKeyDown}
        >
            {content}
        </div>
    );
}
