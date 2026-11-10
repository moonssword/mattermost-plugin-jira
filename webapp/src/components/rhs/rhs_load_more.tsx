// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';

import {RHSSkeletonRows} from './rhs_skeleton';
import {RHS_STRINGS} from './rhs_strings';

// Start loading a little before the end of the list comes into view.
const PRELOAD_MARGIN = '200px';

type Props = {
    loading: boolean;
    onLoadMore: () => void;
    testId?: string;

    // Shows the button even where scrolling could load.
    manual?: boolean;
};

// RHSLoadMore loads the next page when the end of a list scrolls into view.
// Browsers without IntersectionObserver get the "Show more" button.
export default function RHSLoadMore(props: Props): JSX.Element {
    const marker = useRef<HTMLDivElement>(null);
    const onLoadMore = useRef(props.onLoadMore);
    onLoadMore.current = props.onLoadMore;
    const observable = !props.manual && typeof window !== 'undefined' && typeof window.IntersectionObserver === 'function';

    // Observing again after every load fires once more while the marker is
    // still in view, so a short page is followed by the next one.
    useEffect(() => {
        const node = marker.current;
        if (!observable || !node || props.loading) {
            return () => null;
        }
        const observer = new window.IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                observer.disconnect();
                onLoadMore.current();
            }
        }, {rootMargin: PRELOAD_MARGIN});
        observer.observe(node);
        return () => observer.disconnect();
    }, [observable, props.loading]);

    if (props.loading) {
        return (
            <div
                role='status'
                aria-label={RHS_STRINGS.loading}
                data-testid='rhs-list-loading'
            >
                <RHSSkeletonRows count={2}/>
            </div>
        );
    }
    if (!observable) {
        return (
            <button
                type='button'
                className='jira-rhs-load-more'
                data-testid={props.testId || 'rhs-load-more'}
                onClick={props.onLoadMore}
            >
                {RHS_STRINGS.loadMore}
            </button>
        );
    }
    return (
        <div
            ref={marker}
            className='jira-rhs-load-marker'
            aria-hidden={true}
            data-testid={(props.testId || 'rhs-load-more') + '-marker'}
        />
    );
}
