// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import {RHSIssue, RHSIssuesResponse} from 'types/rhs';
import {RHSLanesResponse} from 'types/rhs_board';

export type LoadRHSLaneCounts = () => Promise<{data?: RHSLanesResponse; error?: unknown}>;
export type LoadRHSLanePage = (lane: string, nextPageToken?: string) => Promise<{data?: RHSIssuesResponse; error?: unknown}>;

// RHSLanePage is what is loaded of one column.
export type RHSLanePage = {
    issues: RHSIssue[];
    nextPageToken: string;
    isLast: boolean;
    loading: boolean;
    error: boolean;
};

export type RHSLanesData = {
    counts: Map<string, number | null>;
    categories: Map<string, string>;
    pages: Map<string, RHSLanePage>;
    loadMore: (lane: string) => void;

    // null until the counters come; false when the columns are placed from
    // the loaded list, as for a search by key.
    supported: boolean | null;

    // Loads a column again after an error.
    retry: (lane: string) => void;
};

type Args = {
    loadCounts: LoadRHSLaneCounts;
    loadPage: LoadRHSLanePage;

    // False while the columns are not known yet: nothing is loaded.
    enabled: boolean;

    // A change of the filter, search, sort or board starts over.
    resetKey: string;

    // A change reloads the counters and the open column in place: the list
    // was refreshed after a move or a Jira event.
    refreshKey: string | number;
    activeLane: string;
};

const EMPTY_PAGE: RHSLanePage = {issues: [], nextPageToken: '', isLast: false, loading: true, error: false};

// useRHSLanes loads the counters of every column at once and the issues of a
// column when it is opened, page by page.
export function useRHSLanes(args: Args): RHSLanesData {
    const {enabled, resetKey, refreshKey, activeLane, loadCounts, loadPage} = args;
    const [supported, setSupported] = useState<boolean | null>(null);
    const [counts, setCounts] = useState<Map<string, number | null>>(() => new Map());
    const [categories, setCategories] = useState<Map<string, string>>(() => new Map());
    const [pages, setPages] = useState<Map<string, RHSLanePage>>(() => new Map());

    // Answers to an older generation are dropped.
    const generation = useRef(0);
    const pagesRef = useRef(pages);
    pagesRef.current = pages;

    // Columns whose first page was asked for in this generation.
    const requested = useRef<Set<string>>(new Set());
    const supportedRef = useRef(supported);
    supportedRef.current = supported;

    const setPage = (lane: string, update: (page: RHSLanePage | null) => RHSLanePage | null) => {
        setPages((current) => {
            const next = new Map(current);
            const page = update(current.get(lane) || null);
            if (page) {
                next.set(lane, page);
            } else {
                next.delete(lane);
            }
            return next;
        });
    };

    const fetchPage = useCallback(async (lane: string, token: string, keep: boolean) => {
        const gen = generation.current;
        if (!token) {
            requested.current.add(lane);
        }
        setPage(lane, (page) => {
            if (token) {
                return page ? {...page, loading: true, error: false} : null;
            }
            return keep && page ? {...page, loading: true, error: false} : EMPTY_PAGE;
        });
        const {data, error} = await loadPage(lane, token);
        if (gen !== generation.current) {
            return;
        }
        setPage(lane, (page) => {
            if (error || !data) {
                return {...(page || EMPTY_PAGE), loading: false, error: true};
            }
            return {
                issues: token && page ? page.issues.concat(data.issues) : data.issues,
                nextPageToken: data.nextPageToken,
                isLast: data.isLast || !data.nextPageToken,
                loading: false,
                error: false,
            };
        });
    }, [loadPage]);

    const fetchCounts = useCallback(async () => {
        const gen = generation.current;
        const {data, error} = await loadCounts();
        if (gen !== generation.current) {
            return;
        }
        if (error || !data) {
            // The view still works from the loaded list.
            setSupported(false);
            return;
        }
        setSupported(data.supported);
        setCounts(new Map(data.lanes.map((lane) => [lane.id, lane.count])));
        setCategories(new Map(data.lanes.map((lane) => [lane.id, lane.categoryKey || ''])));
    }, [loadCounts]);

    // Start over: drop everything, count, and load the open column.
    const resetAt = useRef(refreshKey);
    useEffect(() => {
        generation.current++;
        requested.current = new Set();
        resetAt.current = refreshKey;
        setSupported(null);
        setCounts(new Map());
        setPages(new Map());
        if (!enabled) {
            return;
        }
        fetchCounts();
        if (activeLane) {
            fetchPage(activeLane, '', false);
        }

    // The open column is loaded by the effect below when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resetKey, enabled]);

    // Refresh in place: other columns load again when opened. A refresh that
    // comes with a reset is already covered by it.
    useEffect(() => {
        if (!enabled || refreshKey === resetAt.current) {
            return;
        }
        resetAt.current = refreshKey;
        generation.current++;
        requested.current = new Set();
        fetchCounts();
        setPages((current) => {
            const page = current.get(activeLane);
            return page ? new Map([[activeLane, page]]) : new Map();
        });
        if (activeLane && supportedRef.current !== false) {
            fetchPage(activeLane, '', true);
        }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshKey]);

    // Opening a column loads it.
    useEffect(() => {
        if (enabled && activeLane && supported !== false && !requested.current.has(activeLane)) {
            fetchPage(activeLane, '', false);
        }
    }, [enabled, activeLane, supported, fetchPage]);

    const loadMore = useCallback((lane: string) => {
        const page = pagesRef.current.get(lane);
        if (page && !page.loading && !page.isLast && page.nextPageToken) {
            fetchPage(lane, page.nextPageToken, true);
        }
    }, [fetchPage]);

    const retry = useCallback((lane: string) => {
        const page = pagesRef.current.get(lane);
        if (page && page.issues.length > 0 && page.nextPageToken) {
            fetchPage(lane, page.nextPageToken, true);
            return;
        }
        fetchPage(lane, '', false);
    }, [fetchPage]);

    return {supported, counts, categories, pages, loadMore, retry};
}
