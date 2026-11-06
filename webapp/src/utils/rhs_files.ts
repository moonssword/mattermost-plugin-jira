// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Files added to Jira from the panel forms: how they are named and referenced
// in the wiki text.

const IMAGE_FILE = /\.(png|jpe?g|gif|webp|bmp)$/i;

// rhsFileName mirrors rhsAttachmentName of the server: the reference written
// into the text must match the name the file gets in Jira.
export function rhsFileName(name: string): string {
    return name.replace(/[!|[\]{}/\\]/g, '_').trim() || 'file';
}

export function rhsFileReference(name: string): string {
    return IMAGE_FILE.test(name) ? '!' + name + '|thumbnail!' : '[^' + name + ']';
}

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

// Screenshots from the clipboard are all called image.png: give each its own
// name, or they would replace one another in the text.
export function rhsPastedFileName(file: File, now: Date, index: number): string {
    if (file.name && !(/^image\.\w+$/i).test(file.name)) {
        return rhsFileName(file.name);
    }
    const extension = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const stamp = String(now.getFullYear()) + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' +
        pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
    return 'screenshot-' + stamp + (index ? '-' + index : '') + '.' + extension;
}

// Files of a paste event. A spreadsheet pastes both text and a picture of it:
// the text is what people want then.
export function rhsClipboardFiles(data: DataTransfer | null): File[] {
    if (!data || data.getData('text/plain')) {
        return [];
    }
    return Array.from(data.files || []);
}

export function rhsNamedFile(file: File, name: string): File {
    return file.name === name ? file : new File([file], name, {type: file.type});
}

export function rhsInsertAtCursor(text: string, start: number, end: number, insert: string): {text: string; cursor: number} {
    const before = text.slice(0, start);
    const lead = before && !before.endsWith('\n') ? '\n' : '';
    const value = lead + insert + '\n';
    return {text: before + value + text.slice(end), cursor: before.length + value.length};
}
