// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';

export type RHSMenuItem = {
    id: string;
    label: string;
    checked?: boolean;

    // Draws a line above the item.
    separated?: boolean;
    onSelect: () => void;
};

export type Props = {
    label: string;
    items: RHSMenuItem[];
    buttonClassName: string;
    testId: string;
    title?: string;
    align?: 'left' | 'right';
    children: React.ReactNode;
};

// RHSMenu is a small dropdown for the filter bar: a button that opens a list
// of menu items. Escape, a click outside or a choice closes it.
export default function RHSMenu(props: Props): JSX.Element {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

    useEffect(() => {
        if (!open) {
            return () => null;
        }
        const onDown = (event: MouseEvent) => {
            if (root.current && !root.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDown);
        const checked = props.items.findIndex((item) => item.checked);
        itemRefs.current[checked >= 0 ? checked : 0]?.focus();
        return () => document.removeEventListener('mousedown', onDown);

    // Focus moves into the menu only when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const close = () => {
        setOpen(false);
        button.current?.focus();
    };

    const onMenuKeyDown = (event: React.KeyboardEvent) => {
        const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            items[(index + 1) % items.length]?.focus();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            items[((index - 1) + items.length) % items.length]?.focus();
        } else if (event.key === 'Tab') {
            setOpen(false);
        }
    };

    return (
        <div
            className='jira-rhs-menu'
            ref={root}
        >
            <button
                ref={button}
                type='button'
                className={props.buttonClassName}
                aria-haspopup='menu'
                aria-expanded={open}
                aria-label={props.label}
                title={props.title}
                data-testid={props.testId}
                onClick={() => setOpen(!open)}
            >
                {props.children}
            </button>
            {open && (
                <div
                    className={'jira-rhs-menu-list' + (props.align === 'right' ? ' jira-rhs-menu-list--right' : '')}
                    role='menu'
                    aria-label={props.label}
                    onKeyDown={onMenuKeyDown}
                >
                    {props.items.map((item, index) => (
                        <button
                            key={item.id}
                            ref={(node) => {
                                itemRefs.current[index] = node;
                            }}
                            type='button'
                            role={typeof item.checked === 'boolean' ? 'menuitemradio' : 'menuitem'}
                            aria-checked={item.checked}
                            className={'jira-rhs-menu-item' + (item.separated ? ' jira-rhs-menu-item--separated' : '')}
                            data-testid={props.testId + '-' + item.id}
                            onClick={() => {
                                close();
                                item.onSelect();
                            }}
                        >
                            <span className='jira-rhs-menu-check'>
                                {item.checked && (
                                    <i
                                        className='icon icon-check'
                                        aria-hidden={true}
                                    />
                                )}
                            </span>
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
