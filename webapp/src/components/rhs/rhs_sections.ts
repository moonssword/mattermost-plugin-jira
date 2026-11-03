// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ComponentType} from 'react';

import {RHSSectionID} from 'types/rhs_nav';

import ChannelSection from './sections/channel';
import CreateSection from './sections/create';
import MyIssuesSection from './sections/my_issues';
import {RHS_STRINGS} from './rhs_strings';

// Props every section receives from the RHS shell. Sections read the rest of
// their data from the store through their own containers.
export type RHSSectionProps = {
    instanceID: string;

    // Full-panel sections (no tab) return to the previous tab with it.
    onBack?: () => void;
};

export type RHSSectionDef = {
    id: RHSSectionID;
    title: string;
    component: ComponentType<RHSSectionProps>;

    // false: no tab; the section takes the whole panel and is opened by an
    // action (the "Создать задачу" bar, the post menu).
    tab?: boolean;
};

// Order here is the order of tabs in the panel. To add a section: add its id to
// RHSSectionID, create components/rhs/sections/<name>/ and list it here.
export const RHS_SECTIONS: RHSSectionDef[] = [
    {id: 'my_issues', title: RHS_STRINGS.sectionMyIssuesShort, component: MyIssuesSection},
    {id: 'channel', title: RHS_STRINGS.sectionChannel, component: ChannelSection},
    {id: 'create', title: RHS_STRINGS.sectionCreate, component: CreateSection, tab: false},
];

export const RHS_TAB_SECTIONS: RHSSectionDef[] = RHS_SECTIONS.filter((section) => section.tab !== false);

export function findRHSSection(id: RHSSectionID): RHSSectionDef {
    return RHS_SECTIONS.find((section) => section.id === id) || RHS_SECTIONS[0];
}
