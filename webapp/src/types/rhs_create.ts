// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// What the "Создать" section starts with. A new nonce resets the form, so a
// second "Создать задачу Jira" on another message replaces the first one.
export type RHSCreatePrefill = {
    postId: string;
    summary: string;
    description: string;
    nonce: number;
};
