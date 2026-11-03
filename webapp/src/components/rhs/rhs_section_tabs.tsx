// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';

import {RHSSectionID} from 'types/rhs_nav';

import {RHSSectionDef} from './rhs_sections';
import {RHS_STRINGS} from './rhs_strings';

export const RHS_SECTION_PANEL_ID = 'jira-rhs-section-panel';

export function rhsSectionDomId(id: RHSSectionID): string {
    return 'jira-rhs-section-' + id;
}

export type Props = {
    sections: RHSSectionDef[];
    selected: RHSSectionID;
    onSelect: (id: RHSSectionID) => void;
};

export default function RHSSectionTabs(props: Props): JSX.Element {
    const refs = useRef<Map<RHSSectionID, HTMLButtonElement>>(new Map());

    const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        let next = index;
        if (event.key === 'ArrowRight') {
            next = (index + 1) % props.sections.length;
        } else if (event.key === 'ArrowLeft') {
            next = ((index - 1) + props.sections.length) % props.sections.length;
        } else if (event.key === 'Home') {
            next = 0;
        } else if (event.key === 'End') {
            next = props.sections.length - 1;
        } else {
            return;
        }
        event.preventDefault();
        const section = props.sections[next];
        props.onSelect(section.id);
        refs.current.get(section.id)?.focus();
    };

    return (
        <div
            className='jira-rhs-sections'
            role='tablist'
            aria-label={RHS_STRINGS.sectionsLabel}
            data-testid='rhs-section-tabs'
        >
            {props.sections.map((section, index) => {
                const selected = section.id === props.selected;
                return (
                    <button
                        key={section.id}
                        id={rhsSectionDomId(section.id)}
                        type='button'
                        role='tab'
                        aria-selected={selected}
                        aria-controls={RHS_SECTION_PANEL_ID}
                        tabIndex={selected ? 0 : -1}
                        className={selected ? 'jira-rhs-section-tab jira-rhs-section-tab--selected' : 'jira-rhs-section-tab'}
                        data-testid={'rhs-section-' + section.id}
                        ref={(node) => {
                            if (node) {
                                refs.current.set(section.id, node);
                            } else {
                                refs.current.delete(section.id);
                            }
                        }}
                        onClick={() => props.onSelect(section.id)}
                        onKeyDown={(event) => onKeyDown(event, index)}
                    >
                        {section.title}
                    </button>
                );
            })}
        </div>
    );
}
