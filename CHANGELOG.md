# Changelog

All notable changes of this fork. Changes of the upstream plugin are in its [releases](https://github.com/mattermost/mattermost-plugin-jira/releases).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are `<upstream version>-rhs.<n>`.

## [Unreleased]

### Fixed

- Panel shortcuts (C for a new issue, / for search) worked only after a click on a button in the panel. The panel now takes the focus when it opens, on a click anywhere in it and after going back from the card, the settings or a form; C works in any keyboard layout. Typing in the message box is left alone.

## [4.8.3-rhs.1] — 2026-11-10

First release of the fork, built on upstream [v4.8.3](https://github.com/mattermost/mattermost-plugin-jira/releases/tag/v4.8.3). Requires Mattermost 10.7 or later.

### Added

- Right-hand sidebar with the sections *My issues* and *Channel*, a connect screen, an instance picker and personal settings (language, style, notifications).
- *My issues*: quick filters, search by key, text and JQL, sorting, a list grouped by status category and a board view with the board's columns.
- Group and column counters loaded at once; issues loaded per group or column and page by page on scroll.
- Board picker with the progress of the active sprint or of a Kanban board.
- Issue card: fields, description and comments rendered from Jira wiki, Confluence, Markdown and Yandex markup; status changes with transition screens; assignee; comments with files and pasted screenshots; attachments as tiles in the Mattermost file viewer; share to the channel.
- Create form in the panel with the project's fields and attachments; the original dialog remains available.
- Attaching a message to an issue from the panel.
- Channel subscriptions in the panel: create, edit, pause, delete.
- Live updates of the list and the card from Jira webhook events.
- Russian translation of the panel, the System Console page, bot messages, slash command replies and the texts written into Jira.
- Compact and card styles; light and dark themes.
- Development mode that limits the plugin to listed users.
- Connected users count, in all and per instance, on the System Console page.
- Jira icons, avatars and attachments served by the plugin server.

### Changed

- The plugin settings page renders in the administrator's language and stays visible while the plugin is disabled.
- The create form posts to the channel only when asked; in direct and group messages it offers to tell the chat.
- Bot posts no longer show the reporter's avatar, which the browser loaded straight from Jira.
- Channel posts and texts written into Jira follow the default interface language of the server (`DefaultClientLocale`), then `DefaultServerLocale`.
- Label suggestions ask Jira by the field's JQL name, so they work with a translated Jira.
- Pressing Enter in a form field no longer submits the form; Ctrl/⌘+Enter does.

### Fixed

- Kanban progress counted issues hidden by the board's sub-filter.
- A JQL error pointed at the `ORDER BY` the panel adds instead of the query as typed.
- The create form showed raw server errors when Jira did not answer.
