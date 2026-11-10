// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act, render, screen} from '@testing-library/react';

import RHSLoadMore from './rhs_load_more';

type Callback = (entries: Array<{isIntersecting: boolean}>) => void;

describe('RHSLoadMore', () => {
    const original = window.IntersectionObserver;
    let observers: Array<{callback: Callback; disconnected: boolean}> = [];

    beforeEach(() => {
        observers = [];
        (window as unknown as {IntersectionObserver: unknown}).IntersectionObserver = class {
            entry: {callback: Callback; disconnected: boolean};
            constructor(callback: Callback) {
                this.entry = {callback, disconnected: false};
                observers.push(this.entry);
            }
            observe() {
                return null;
            }
            disconnect() {
                this.entry.disconnected = true;
            }
        };
    });

    afterEach(() => {
        (window as unknown as {IntersectionObserver: unknown}).IntersectionObserver = original;
    });

    test('loads the next page when the end of the list comes into view', () => {
        const onLoadMore = jest.fn();
        const {rerender} = render(
            <RHSLoadMore
                loading={false}
                onLoadMore={onLoadMore}
            />,
        );
        expect(screen.getByTestId('rhs-load-more-marker')).toBeInTheDocument();
        expect(screen.queryByTestId('rhs-load-more')).not.toBeInTheDocument();

        act(() => observers[0].callback([{isIntersecting: false}]));
        expect(onLoadMore).not.toHaveBeenCalled();
        act(() => observers[0].callback([{isIntersecting: true}]));
        expect(onLoadMore).toHaveBeenCalledTimes(1);
        expect(observers[0].disconnected).toBe(true);

        // While the page loads, skeleton rows; then the marker is watched again.
        rerender(
            <RHSLoadMore
                loading={true}
                onLoadMore={onLoadMore}
            />,
        );
        expect(screen.getByTestId('rhs-list-loading')).toBeInTheDocument();
        rerender(
            <RHSLoadMore
                loading={false}
                onLoadMore={onLoadMore}
            />,
        );
        expect(observers).toHaveLength(2);
        act(() => observers[1].callback([{isIntersecting: true}]));
        expect(onLoadMore).toHaveBeenCalledTimes(2);
    });
});
