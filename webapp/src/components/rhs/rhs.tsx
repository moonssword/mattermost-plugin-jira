// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import {Instance} from 'types/model';
import {RHSErrorCode, RHSViewState} from 'types/rhs';
import {RHSSectionID} from 'types/rhs_nav';

import AttachView from './attach_view';
import IssueCard from './issue_card';
import {RHSConnectScreen, RHSNoInstanceScreen} from './rhs_connect_screen';
import RHSPanelHeader from './rhs_panel_header';
import RHSSectionTabs, {RHS_SECTION_PANEL_ID, rhsSectionDomId} from './rhs_section_tabs';
import {RHS_SECTIONS, findRHSSection} from './rhs_sections';
import {RHSLoadingState} from './rhs_states';
import {RHS_STRINGS} from './rhs_strings';
import SettingsView from './settings_view';

import './rhs.scss';

export type Props = {
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
        content = <RHSLoadingState/>;
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

        // The card covers the sections; they stay mounted to keep the list
        // and its scroll position for "back".
        // Settings, attach and the card are views over the sections; at most
        // one shows, settings first.
        const settingsOpen = props.settingsOpen;
        const attachOpen = !settingsOpen && Boolean(props.attachPostId);
        const cardOpen = !settingsOpen && !attachOpen && Boolean(props.issueKey);
        content = (
            <>
                {settingsOpen && <SettingsView/>}
                {attachOpen && <AttachView/>}
                {cardOpen && <IssueCard/>}
                <div
                    className='jira-rhs-main'
                    hidden={cardOpen || attachOpen || settingsOpen}
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
                        sections={RHS_SECTIONS}
                        selected={active.id}
                        onSelect={props.setRHSSection}
                    />
                    <div
                        className='jira-rhs-section'
                        role='tabpanel'
                        id={RHS_SECTION_PANEL_ID}
                        aria-labelledby={rhsSectionDomId(active.id)}
                    >
                        <Section instanceID={activeInstanceID}/>
                    </div>
                </div>
            </>
        );
        break;
    }
    default: {
        const exhaustive: never = screen;
        content = exhaustive;
    }
    }

    return (
        <div
            className='jira-rhs'
            data-testid='jira-rhs'
        >
            {content}
        </div>
    );
}
