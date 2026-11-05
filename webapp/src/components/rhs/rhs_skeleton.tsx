// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import '../loading.scss';

import {RHS_STRINGS} from './rhs_strings';

// Skeletons of the panel screens. They use the classes of the real elements,
// so a screen keeps its layout in both styles when the content arrives.
function Bar(props: {width: string | number; height?: number; className?: string}): JSX.Element {
    return (
        <span
            className={'jira-skel' + (props.className ? ' ' + props.className : '')}
            style={{width: props.width, height: props.height}}
            aria-hidden={true}
        />
    );
}

function Status(props: {className?: string; testId?: string; children: React.ReactNode}): JSX.Element {
    return (
        <div
            className={props.className}
            role='status'
            aria-busy={true}
            aria-label={RHS_STRINGS.loading}
            data-testid={props.testId || 'rhs-state-loading'}
        >
            {props.children}
        </div>
    );
}

const SUMMARY_WIDTHS = ['82%', '64%', '90%', '71%', '56%', '78%', '68%'];

export function RHSSkeletonRows(props: {count?: number}): JSX.Element {
    return (
        <>
            {SUMMARY_WIDTHS.slice(0, props.count || 6).map((width) => (
                <div
                    key={width}
                    className='jira-rhs-row jira-rhs-row--skeleton'
                    aria-hidden={true}
                >
                    <Bar
                        width={16}
                        height={16}
                    />
                    <span className='jira-rhs-row-key'><Bar width={54}/></span>
                    <span className='jira-rhs-row-summary jira-rhs-row-summary--skeleton'><Bar width={width}/></span>
                    <span/>
                    <span className='jira-rhs-row-priority'>
                        <Bar
                            width={14}
                            height={14}
                        />
                    </span>
                    <span className='jira-rhs-mini-avatar jira-rhs-mini-avatar--skeleton'>
                        <Bar
                            width={20}
                            height={20}
                            className='jira-skel--round'
                        />
                    </span>
                </div>
            ))}
        </>
    );
}

export function RHSSkeletonList(): JSX.Element {
    return (
        <Status className='jira-rhs-list'>
            <div className='jira-rhs-group-header jira-rhs-group-header--skeleton'><Bar width={96}/></div>
            <RHSSkeletonRows count={2}/>
            <div className='jira-rhs-group-header jira-rhs-group-header--skeleton'><Bar width={120}/></div>
            <RHSSkeletonRows count={5}/>
        </Status>
    );
}

// The panel before the first answer: instance, tabs, sprint, filters and a list.
export function RHSSkeletonPanel(): JSX.Element {
    return (
        <Status className='jira-rhs-skeleton-panel'>
            <div className='jira-rhs-panel-header'>
                <Bar
                    width={150}
                    height={14}
                />
            </div>
            <div className='jira-rhs-sections'>
                <Bar
                    width='100%'
                    height={24}
                />
            </div>
            <div className='jira-rhs-sstrip jira-rhs-sstrip--skeleton'>
                <Bar width='100%'/>
            </div>
            <div className='jira-rhs-fbar'>
                <Bar
                    width={120}
                    height={24}
                />
                <Bar
                    width={90}
                    height={24}
                />
            </div>
            <div className='jira-rhs-list'>
                <div className='jira-rhs-group-header jira-rhs-group-header--skeleton'><Bar width={96}/></div>
                <RHSSkeletonRows count={2}/>
                <div className='jira-rhs-group-header jira-rhs-group-header--skeleton'><Bar width={120}/></div>
                <RHSSkeletonRows count={4}/>
            </div>
        </Status>
    );
}

// The sprint strip in one line, without the words of a loading message.
export function RHSSkeletonSprint(): JSX.Element {
    return (
        <span
            className='jira-rhs-sstrip-skeleton'
            role='status'
            aria-label={RHS_STRINGS.loading}
            data-testid='rhs-sprint-skeleton'
        >
            <Bar width='100%'/>
        </span>
    );
}

const FIELD_WIDTHS = ['38%', '52%', '30%', '44%'];

export function RHSSkeletonCard(): JSX.Element {
    return (
        <Status className='jira-rhs-card-body'>
            <div className='jira-rhs-card-kind'><Bar width={150}/></div>
            <div className='jira-rhs-card-summary'>
                <Bar
                    width='86%'
                    height={18}
                />
            </div>
            <div className='jira-rhs-card-actions'>
                <Bar
                    width={110}
                    height={30}
                />
                <Bar
                    width={90}
                    height={30}
                />
            </div>
            <dl className='jira-rhs-card-fields'>
                {FIELD_WIDTHS.map((width) => (
                    <React.Fragment key={width}>
                        <dt><Bar width={70}/></dt>
                        <dd><Bar width={width}/></dd>
                    </React.Fragment>
                ))}
            </dl>
            <section className='jira-rhs-card-section'>
                <div className='jira-skel-stack'>
                    <Bar width={90}/>
                    <Bar width='100%'/>
                    <Bar width='92%'/>
                    <Bar width='60%'/>
                </div>
            </section>
        </Status>
    );
}

function SkeletonField(props: {wide?: boolean; tall?: boolean}): JSX.Element {
    return (
        <div className={props.wide ? 'jira-rhs-field jira-rhs-field--wide' : 'jira-rhs-field'}>
            <div className='jira-skel-stack jira-skel-stack--tight'>
                <Bar width={72}/>
                <Bar
                    width='100%'
                    height={props.tall ? 72 : 34}
                    className='jira-skel--control'
                />
            </div>
        </div>
    );
}

// The fields of a form; the project and type selects stay above them.
export function RHSSkeletonFields(): JSX.Element {
    return (
        <Status className='jira-rhs-fields'>
            <SkeletonField wide={true}/>
            <SkeletonField
                wide={true}
                tall={true}
            />
            <SkeletonField/>
            <SkeletonField/>
            <SkeletonField/>
            <SkeletonField/>
        </Status>
    );
}

export function RHSSkeletonForm(): JSX.Element {
    return (
        <div className='jira-rhs-form-body'>
            <RHSSkeletonFields/>
        </div>
    );
}

export function RHSSkeletonSubscriptions(): JSX.Element {
    return (
        <Status className='jira-rhs-subscriptions'>
            {['58%', '42%'].map((width) => (
                <div
                    key={width}
                    className='jira-rhs-subscription'
                >
                    <div className='jira-skel-stack'>
                        <Bar
                            width={width}
                            height={14}
                        />
                        <Bar width='76%'/>
                        <Bar width='92%'/>
                    </div>
                </div>
            ))}
        </Status>
    );
}

export function RHSSkeletonSettings(): JSX.Element {
    return (
        <Status className='jira-rhs-settings'>
            <section className='jira-rhs-settings-block'>
                <div className='jira-skel-row'>
                    <Bar
                        width={24}
                        height={24}
                        className='jira-skel--round'
                    />
                    <div className='jira-skel-stack jira-skel-stack--tight jira-skel-grow'>
                        <Bar width='40%'/>
                        <Bar width='62%'/>
                    </div>
                </div>
            </section>
            {[2, 4].map((rows) => (
                <section
                    key={rows}
                    className='jira-rhs-settings-block'
                >
                    <div className='jira-skel-stack'>
                        <Bar width={110}/>
                        {Array.from({length: rows}, (_, index) => (
                            <Bar
                                key={String(index)}
                                width={index % 2 ? '84%' : '70%'}
                                height={16}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </Status>
    );
}

// A list to choose from: boards, or issues for an attached message.
export function RHSSkeletonOptions(props: {itemClassName: string}): JSX.Element {
    return (
        <Status>
            {['64%', '48%', '72%'].map((width) => (
                <div
                    key={width}
                    className={props.itemClassName}
                >
                    <div className='jira-skel-stack jira-skel-stack--tight'>
                        <Bar
                            width={width}
                            height={14}
                        />
                        <Bar width={70}/>
                    </div>
                </div>
            ))}
        </Status>
    );
}
