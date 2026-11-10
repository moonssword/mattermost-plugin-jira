// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

// preventImplicitSubmit keeps a plain Enter in a field from sending the
// form. In a picker with no matching option, Enter meant to add a label
// created the issue instead. Ctrl/⌘+Enter, the buttons and new lines in
// text areas are left alone.
export function preventImplicitSubmit(event: React.KeyboardEvent): void {
    if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
    }
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'submit') {
        event.preventDefault();
    }
}
