// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';

import {RHSBoardRef} from 'types/rhs_board';

import {RHS_STRINGS} from '../../rhs_strings';

export const RHS_BOARD_SEARCH_DEBOUNCE_MS = 300;

export type Props = {
    selectedId: number;
    listBoards: (name: string) => Promise<{data?: RHSBoardRef[]; error?: unknown}>;
    onSelect: (board: RHSBoardRef) => void;
    onClose: () => void;
};

function boardType(type: string): string {
    if (type === 'scrum') {
        return RHS_STRINGS.boardTypeScrum;
    }
    if (type === 'kanban') {
        return RHS_STRINGS.boardTypeKanban;
    }
    return type;
}

// BoardPicker chooses the board whose sprint progress and columns the list
// uses. Boards come from Jira as the connected user sees them.
export default function BoardPicker(props: Props): JSX.Element {
    const [name, setName] = useState('');
    const [boards, setBoards] = useState<RHSBoardRef[] | null>(null);
    const [failed, setFailed] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const request = useRef(0);

    useEffect(() => {
        input.current?.focus();
    }, []);

    useEffect(() => {
        const id = ++request.current;
        const timer = setTimeout(async () => {
            const {data, error} = await props.listBoards(name);
            if (id !== request.current) {
                return;
            }
            setFailed(Boolean(error));
            setBoards(data || []);
        }, name ? RHS_BOARD_SEARCH_DEBOUNCE_MS : 0);
        return () => clearTimeout(timer);

    // listBoards is a bound action creator; only the text drives requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name]);

    let body: React.ReactNode;
    if (failed) {
        body = <p className='jira-rhs-muted'>{RHS_STRINGS.boardPickerFailed}</p>;
    } else if (boards === null) {
        body = <p className='jira-rhs-muted'>{RHS_STRINGS.loadingMore}</p>;
    } else if (boards.length === 0) {
        body = <p className='jira-rhs-muted'>{RHS_STRINGS.boardPickerEmpty}</p>;
    } else {
        body = (
            <ul
                className='jira-rhs-board-list'
                data-testid='rhs-board-list'
            >
                {boards.map((board) => (
                    <li key={board.id}>
                        <button
                            type='button'
                            className={'jira-rhs-board-option' + (board.id === props.selectedId ? ' jira-rhs-board-option--selected' : '')}
                            aria-pressed={board.id === props.selectedId}
                            data-testid={'rhs-board-' + board.id}
                            onClick={() => props.onSelect(board)}
                        >
                            <span className='jira-rhs-board-option-name'>{board.name}</span>
                            <span className='jira-rhs-board-option-meta'>
                                {[boardType(board.type), board.projectKey].filter(Boolean).join(' · ')}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <div
            className='jira-rhs-board-picker'
            role='dialog'
            aria-label={RHS_STRINGS.boardPickerTitle}
            data-testid='rhs-board-picker'
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    event.stopPropagation();
                    props.onClose();
                }
            }}
        >
            <div className='jira-rhs-board-picker-head'>
                <b>{RHS_STRINGS.boardPickerTitle}</b>
                <button
                    type='button'
                    className='jira-rhs-icon-button'
                    aria-label={RHS_STRINGS.createClose}
                    title={RHS_STRINGS.createClose}
                    data-testid='rhs-board-picker-close'
                    onClick={props.onClose}
                >
                    <i
                        className='icon icon-close'
                        aria-hidden={true}
                    />
                </button>
            </div>
            <p className='jira-rhs-muted jira-rhs-board-picker-hint'>{RHS_STRINGS.boardPickerHint}</p>
            <input
                ref={input}
                type='search'
                className='form-control jira-rhs-board-search'
                placeholder={RHS_STRINGS.boardPickerSearch}
                aria-label={RHS_STRINGS.boardPickerSearch}
                data-testid='rhs-board-search'
                value={name}
                onChange={(event) => setName(event.target.value)}
            />
            {body}
        </div>
    );
}
