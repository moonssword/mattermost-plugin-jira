// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"path"
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

// Conversion of Jira and Confluence wiki markup to Mattermost markdown, for the
// issue card and for posts. Markdown that people type or paste into Jira stays
// as it is. Descriptions moved from Yandex Tracker are understood too: its
// markdown dialect (YFM) and the older wiki markup.

// rhsMarkupFile is an attachment of the issue, referenced by its file name.
type rhsMarkupFile struct {
	// URL is relative to the page: it feeds <img>, which the panel renders.
	URL string
	// AbsoluteURL is for markdown links, which need a scheme.
	AbsoluteURL string
	Image       bool
}

type rhsMarkup struct {
	files map[string]rhsMarkupFile
	stash []string
}

var (
	rhsMarkupCode     = regexp.MustCompile(`(?s)\{code(?::([^}\n]*))?\}\n?(.*?)\n?\{code\}`)
	rhsMarkupNoFormat = regexp.MustCompile(`(?s)\{noformat(?::[^}\n]*)?\}\n?(.*?)\n?\{noformat\}`)
	rhsMarkupFence    = regexp.MustCompile("(?ms)^```[^\n]*\n.*?^```[ \t]*$")
	rhsMarkupStashed  = regexp.MustCompile(`\x00(\d+)\x00`)
	rhsMarkupBlanks   = regexp.MustCompile(`\n{3,}`)

	// The renderer joins neighboring quotes and lists into one; an invisible
	// paragraph keeps them apart.
	rhsMarkupNearQuotes = regexp.MustCompile(`(?m)^(>[^\n]*)\n\n+(>)`)
	rhsMarkupNearLists  = regexp.MustCompile(`(?m)^(- [^\n]*)\n\n+(1\. )|^(1\. [^\n]*)\n\n+(- )`)

	rhsMarkupMacroNames = []string{"quote", "panel", "info", "note", "warning", "tip"}
	rhsMarkupMacros     = func() map[string]*regexp.Regexp {
		out := map[string]*regexp.Regexp{}
		for _, name := range rhsMarkupMacroNames {
			out[name] = regexp.MustCompile(`(?s)\{` + name + `(?::([^}\n]*))?\}\n?(.*?)\n?\{` + name + `\}`)
		}
		return out
	}()
	rhsMarkupMacroIcons = map[string]string{"info": "ℹ️", "note": "📝", "warning": "⚠️", "tip": "💡", "alert": "❗"}

	rhsMarkupYandexCode     = regexp.MustCompile(`(?s)%%(?:\(([^)\n]*)\))?(.*?)%%`)
	rhsMarkupYandexTable    = regexp.MustCompile(`(?s)#\|\s*(.*?)\s*\|#(?:[ \t]*\{[^}\n]*\})?`)
	rhsMarkupYandexAttrs    = regexp.MustCompile(`\|:\{([^}\n]*)\}`)
	rhsMarkupYandexHead     = regexp.MustCompile(`header-rows="?([1-9])`)
	rhsMarkupYandexRow      = regexp.MustCompile(`(?s)\|\|(.*?)\|\|`)
	rhsMarkupYandexCell     = regexp.MustCompile(`(?:^|\s)(?:::)?\{[a-z-]+=[^}\n]*\}`)
	rhsMarkupYandexNote     = regexp.MustCompile(`(?s)\{%\s*note\s+(\w+)(?:\s+"([^"]*)")?\s*%\}\n?(.*?)\n?\{%\s*endnote\s*%\}`)
	rhsMarkupYandexCut      = regexp.MustCompile(`(?s)\{%\s*cut\s+"([^"]*)"\s*%\}\n?(.*?)\n?\{%\s*endcut\s*%\}`)
	rhsMarkupYandexOldCut   = regexp.MustCompile(`(?s)<\{([^\n]*)\n(.*?)\}>`)
	rhsMarkupYandexOldQuote = regexp.MustCompile(`(?s)<\[\n?(.*?)\n?\]>`)

	rhsMarkupYandexHeading = regexp.MustCompile(`^(={2,7})\s*([^=]+?)\s*=*$`)
	rhsMarkupHighlightLine = regexp.MustCompile(`^==[^=\s](?:.*[^=\s])?==$`)
	rhsMarkupFoldHeading   = regexp.MustCompile(`^(#{1,6})\+\s`)
	rhsMarkupHeadingAnchor = regexp.MustCompile(`^(#{1,6}\s.*?)\s*\{#[^}\s]+\}$`)
	rhsMarkupHiddenLine    = regexp.MustCompile(`^\[//\]:\s*#`)
	rhsMarkupParenItem     = regexp.MustCompile(`^(\s*\d+)\)\s+`)
	rhsMarkupCheckItem     = regexp.MustCompile(`^\[([ xX])\]\s+(.*)$`)

	rhsMarkupMdImage     = regexp.MustCompile(`!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+[^)\n]*)?\)(?:\{[^}\n]*\})?`)
	rhsMarkupVideo       = regexp.MustCompile(`@\[[^\]\n]*\]\(((?:https?://)[^)\s]+)\)`)
	rhsMarkupYandexLink  = regexp.MustCompile(`\(\(((?:https?://|ftp://|mailto:)[^\s)]+)(?:\s+([^)\n]*))?\)\)`)
	rhsMarkupYandexColor = regexp.MustCompile(`\{(?:gray|yellow|orange|red|green|blue|violet)\}\(([^)\n]*)\)`)
	rhsMarkupYandexRed   = regexp.MustCompile(`!!(?:\([^)\n]*\))?(\S(?:[^!\n]*\S)?)!!`)
	rhsMarkupYandexMono  = rhsMarkupPaired("##")
	rhsMarkupYandexEm    = rhsMarkupPaired("//")
	rhsMarkupYandexDel   = rhsMarkupPaired("--")
	rhsMarkupYandexIns   = rhsMarkupPaired(`\+\+`)
	rhsMarkupYandexMark  = rhsMarkupPaired("==")

	rhsMarkupHeading      = regexp.MustCompile(`^h([1-6])\.\s+(.*)$`)
	rhsMarkupQuoteLine    = regexp.MustCompile(`^bq\.\s+(.*)$`)
	rhsMarkupRule         = regexp.MustCompile(`^-{4,}$`)
	rhsMarkupList         = regexp.MustCompile(`^([*#-]+)\s+(.*)$`)
	rhsMarkupHashes       = regexp.MustCompile(`^#+\s`)
	rhsMarkupTableDivider = regexp.MustCompile(`^\|?[\s:|-]*-[\s:|-]*\|?$`)

	rhsMarkupMonospace = regexp.MustCompile(`\{\{(.+?)\}\}`)
	rhsMarkupColor     = regexp.MustCompile(`\{color(?::[^}\n]*)?\}`)
	rhsMarkupCite      = regexp.MustCompile(`\?\?(\S(?:[^?\n]*\S)?)\?\?`)

	// Spans the inline rules must not touch.
	rhsMarkupProtected    = regexp.MustCompile("`[^`\n]+`|!\\[[^\\]\n]*\\]\\([^)\\s]+\\)|\\[[^\\]\n]*\\]\\([^)\\s]+\\)")
	rhsMarkupProtectedURL = regexp.MustCompile("`[^`\n]+`|!\\[[^\\]\n]*\\]\\([^)\\s]+\\)|\\[[^\\]\n]*\\]\\([^)\\s]+\\)|(?:https?|ftp)://[^\\s<>]+|[\\w.+-]+@[\\w.-]+")

	rhsMarkupImage      = regexp.MustCompile(`(^|[\s>(|])!([^!\s|][^!|\n]*?)(?:\|[^!\n]*)?!`)
	rhsMarkupImageFile  = regexp.MustCompile(`(?i)\.(png|jpe?g|gif|bmp|webp|svg)$`)
	rhsMarkupLink       = regexp.MustCompile(`\[([^\]\[|\n]*)\|([^\]|\n]+)(?:\|[^\]\n]*)?\]`)
	rhsMarkupBareLink   = regexp.MustCompile(`\[((?:https?|ftp)://[^\]\s|]+|mailto:[^\]\s|]+)\]`)
	rhsMarkupFileLink   = regexp.MustCompile(`\[\^([^\]\n]+)\]`)
	rhsMarkupMention    = regexp.MustCompile(`\[~([^\]\s:]+)\]`)
	rhsMarkupLinkTarget = regexp.MustCompile(`^(?:https?://|ftp://|mailto:)`)
)

// rhsMarkupPaired matches a doubled marker around text, at word boundaries.
func rhsMarkupPaired(marker string) *regexp.Regexp {
	return regexp.MustCompile(`(^|[\s(«"])` + marker + `(\S(?:[^\n]*?\S)?)` + marker + `($|[\s).,;:!?»"])`)
}

// rhsMarkupReplacePaired runs twice, as neighbors share the space between them.
func rhsMarkupReplacePaired(re *regexp.Regexp, s, replacement string) string {
	return re.ReplaceAllString(re.ReplaceAllString(s, replacement), replacement)
}

// jiraTextToMarkdown converts the text of a description or a comment.
func jiraTextToMarkdown(s string, files map[string]rhsMarkupFile) string {
	m := &rhsMarkup{files: files}
	s = strings.ReplaceAll(strings.ReplaceAll(s, "\r\n", "\n"), "\x00", "")

	s = rhsMarkupFence.ReplaceAllStringFunc(s, m.hold)
	s = rhsMarkupCode.ReplaceAllStringFunc(s, func(block string) string {
		parts := rhsMarkupCode.FindStringSubmatch(block)
		return m.hold("```" + rhsMarkupCodeLanguage(parts[1]) + "\n" + parts[2] + "\n```")
	})
	s = rhsMarkupNoFormat.ReplaceAllStringFunc(s, func(block string) string {
		return m.hold("```\n" + rhsMarkupNoFormat.FindStringSubmatch(block)[1] + "\n```")
	})
	s = rhsMarkupYandexCode.ReplaceAllStringFunc(s, func(block string) string {
		parts := rhsMarkupYandexCode.FindStringSubmatch(block)
		body := strings.Trim(parts[2], "\n")
		if parts[1] == "" && !strings.Contains(body, "\n") {
			return "`" + body + "`"
		}
		return m.hold("```" + parts[1] + "\n" + body + "\n```")
	})
	s = rhsMarkupYandexTable.ReplaceAllStringFunc(s, func(block string) string {
		return m.hold(strings.Join(m.yandexTable(rhsMarkupYandexTable.FindStringSubmatch(block)[1]), "\n"))
	})
	s = rhsMarkupYandexNote.ReplaceAllStringFunc(s, func(block string) string {
		parts := rhsMarkupYandexNote.FindStringSubmatch(block)
		title := rhsMarkupMacroIcons[parts[1]]
		if parts[2] != "" {
			title = strings.TrimSpace(title + " **" + parts[2] + "**")
		}
		return m.quote(title, parts[3])
	})
	s = rhsMarkupYandexCut.ReplaceAllStringFunc(s, func(block string) string {
		parts := rhsMarkupYandexCut.FindStringSubmatch(block)
		return m.quote("**"+parts[1]+"**", parts[2])
	})
	s = rhsMarkupYandexOldCut.ReplaceAllStringFunc(s, func(block string) string {
		parts := rhsMarkupYandexOldCut.FindStringSubmatch(block)
		return m.quote("**"+strings.TrimSpace(parts[1])+"**", parts[2])
	})
	s = rhsMarkupYandexOldQuote.ReplaceAllStringFunc(s, func(block string) string {
		return m.quote("", rhsMarkupYandexOldQuote.FindStringSubmatch(block)[1])
	})
	for _, name := range rhsMarkupMacroNames {
		s = m.convertMacro(name, s)
	}

	out := rhsMarkupBlanks.ReplaceAllString(m.restore(m.blocks(s)), "\n\n")
	out = rhsMarkupNearQuotes.ReplaceAllString(out, "$1\n\n\u200b\n\n$2")
	out = rhsMarkupNearLists.ReplaceAllString(out, "$1$3\n\n\u200b\n\n$2$4")
	return strings.TrimSpace(out)
}

func rhsMarkupCodeLanguage(options string) string {
	for _, option := range strings.Split(options, "|") {
		option = strings.TrimSpace(option)
		if strings.HasPrefix(option, "language=") {
			return strings.TrimPrefix(option, "language=")
		}
		if option != "" && !strings.Contains(option, "=") {
			return option
		}
	}
	return ""
}

func (m *rhsMarkup) hold(block string) string {
	m.stash = append(m.stash, block)
	return "\n\x00" + strconv.Itoa(len(m.stash)-1) + "\x00\n"
}

func (m *rhsMarkup) restore(s string) string {
	for rhsMarkupStashed.MatchString(s) {
		s = rhsMarkupStashed.ReplaceAllStringFunc(s, func(token string) string {
			i, err := strconv.Atoi(strings.Trim(token, "\x00"))
			if err != nil || i >= len(m.stash) {
				return ""
			}
			return m.stash[i]
		})
	}
	return s
}

// convertMacro turns {quote}, {panel} and Confluence's {info}, {note},
// {warning}, {tip} into blockquotes.
func (m *rhsMarkup) convertMacro(name, s string) string {
	re := rhsMarkupMacros[name]
	return re.ReplaceAllStringFunc(s, func(block string) string {
		parts := re.FindStringSubmatch(block)

		title := rhsMarkupMacroIcons[name]
		for _, option := range strings.Split(parts[1], "|") {
			if value, ok := strings.CutPrefix(strings.TrimSpace(option), "title="); ok && value != "" {
				title = strings.TrimSpace(title + " **" + value + "**")
			}
		}
		return m.quote(title, parts[2])
	})
}

func (m *rhsMarkup) quote(title, text string) string {
	body := m.restore(m.blocks(text))
	lines := strings.Split(strings.TrimSpace(rhsMarkupBlanks.ReplaceAllString(body, "\n\n")), "\n")
	if title != "" {
		lines = append([]string{title, ""}, lines...)
	}
	for i, line := range lines {
		lines[i] = strings.TrimRight("> "+line, " ")
	}
	return m.hold(strings.Join(lines, "\n"))
}

// yandexTable converts the #| || a | b || |# table. Text in a cell may span
// lines; markdown cells cannot, and merged cells (^ and >) stay empty.
func (m *rhsMarkup) yandexTable(body string) []string {
	headerRows := rhsMarkupYandexHead.MatchString(body)
	body = rhsMarkupYandexAttrs.ReplaceAllString(body, "")

	var rows []string
	columns := 0
	for _, match := range rhsMarkupYandexRow.FindAllStringSubmatch(body, -1) {
		row := m.inline(strings.Join(strings.Fields(match[1]), " "), true)
		cells := strings.Split(row, "|")
		for i, cell := range cells {
			cell = strings.TrimSpace(rhsMarkupYandexCell.ReplaceAllString(cell, ""))
			if cell == "^" || cell == ">" {
				cell = ""
			}
			cells[i] = cell
		}
		if len(cells) > columns {
			columns = len(cells)
		}
		rows = append(rows, "| "+strings.Join(cells, " | ")+" |")
	}
	if len(rows) == 0 {
		return []string{body}
	}
	divider := "|" + strings.Repeat("---|", columns)
	if headerRows {
		return append([]string{rows[0], divider}, rows[1:]...)
	}
	return append([]string{"|" + strings.Repeat("  |", columns), divider}, rows...)
}

func (m *rhsMarkup) blocks(s string) string {
	lines := strings.Split(s, "\n")
	out := make([]string, 0, len(lines))
	for i := 0; i < len(lines); i++ {
		line := strings.TrimSpace(lines[i])

		if rhsMarkupHiddenLine.MatchString(line) {
			continue
		}
		if !rhsMarkupHighlightLine.MatchString(line) {
			if parts := rhsMarkupYandexHeading.FindStringSubmatch(line); parts != nil {
				out = append(out, strings.Repeat("#", len(parts[1])-1)+" "+m.inline(parts[2], false))
				continue
			}
		}
		line = rhsMarkupFoldHeading.ReplaceAllString(line, "$1 ")
		line = rhsMarkupHeadingAnchor.ReplaceAllString(line, "$1")
		if parts := rhsMarkupCheckItem.FindStringSubmatch(line); parts != nil {
			mark := "☑ "
			if parts[1] == " " {
				mark = "☐ "
			}
			out = append(out, mark+m.inline(parts[2], false))
			continue
		}

		if rhsMarkupStashed.MatchString(line) {
			out = append(out, "", line, "")
			continue
		}
		if strings.HasPrefix(line, "|") {
			end := i
			for end+1 < len(lines) && strings.HasPrefix(strings.TrimSpace(lines[end+1]), "|") {
				end++
			}
			out = append(out, "")
			out = append(out, m.table(lines[i:end+1])...)
			out = append(out, "")
			i = end
			continue
		}
		if parts := rhsMarkupHeading.FindStringSubmatch(line); parts != nil {
			level, _ := strconv.Atoi(parts[1])
			out = append(out, strings.Repeat("#", level)+" "+m.inline(parts[2], false))
			continue
		}
		if parts := rhsMarkupQuoteLine.FindStringSubmatch(line); parts != nil {
			out = append(out, "> "+m.inline(parts[1], false), "")
			continue
		}
		if rhsMarkupRule.MatchString(line) {
			out = append(out, "", "---", "")
			continue
		}
		if parts := rhsMarkupList.FindStringSubmatch(line); parts != nil {
			// A markdown list is nested by indentation, a wiki one by its marks.
			indent := lines[i][:len(lines[i])-len(strings.TrimLeft(lines[i], " \t"))]
			out = append(out, indent+rhsMarkupListLine(parts[1], m.inline(parts[2], false), rhsMarkupNearHashes(lines, i)))
			continue
		}
		out = append(out, m.inline(rhsMarkupParenItem.ReplaceAllString(lines[i], "$1. "), false))
	}
	return strings.Join(out, "\n")
}

// rhsMarkupNearHashes tells a numbered list from markdown headings: in wiki
// markup "# item" is a list, so it needs a neighbor to be one.
func rhsMarkupNearHashes(lines []string, i int) bool {
	return (i > 0 && rhsMarkupHashes.MatchString(strings.TrimSpace(lines[i-1]))) ||
		(i+1 < len(lines) && rhsMarkupHashes.MatchString(strings.TrimSpace(lines[i+1])))
}

func rhsMarkupListLine(marks, text string, nearHashes bool) string {
	last := marks[len(marks)-1]
	if strings.Trim(marks, "#") == "" && !nearHashes {
		level := len(marks)
		if level > 6 {
			level = 6
		}
		return strings.Repeat("#", level) + " " + text
	}
	marker := "- "
	if last == '#' {
		marker = "1. "
	}
	return strings.Repeat("    ", len(marks)-1) + marker + text
}

func (m *rhsMarkup) table(rows []string) []string {
	if len(rows) > 1 && rhsMarkupTableDivider.MatchString(strings.TrimSpace(rows[1])) {
		return rows
	}
	out := make([]string, 0, len(rows)+2)
	for i, raw := range rows {
		row := m.inline(strings.TrimSpace(raw), true)
		header := strings.HasPrefix(row, "||")
		separator := "|"
		if header {
			separator = "||"
		}
		cells := strings.Split(strings.Trim(row, "|"), separator)
		for j, cell := range cells {
			cells[j] = strings.TrimSpace(strings.Trim(cell, "|"))
		}
		line := "| " + strings.Join(cells, " | ") + " |"
		if i == 0 {
			divider := "|" + strings.Repeat("---|", len(cells))
			if !header {
				out = append(out, "|"+strings.Repeat("  |", len(cells)), divider)
			} else {
				out = append(out, line, divider)
				continue
			}
		}
		out = append(out, line)
	}
	return out
}

func rhsMarkupOutside(s string, protected *regexp.Regexp, convert func(string) string) string {
	var b strings.Builder
	last := 0
	for _, span := range protected.FindAllStringIndex(s, -1) {
		b.WriteString(convert(s[last:span[0]]))
		b.WriteString(s[span[0]:span[1]])
		last = span[1]
	}
	b.WriteString(convert(s[last:]))
	return b.String()
}

func (m *rhsMarkup) inline(s string, inTable bool) string {
	s = rhsMarkupMonospace.ReplaceAllString(s, "`$1`")
	s = rhsMarkupMdImage.ReplaceAllStringFunc(s, func(match string) string {
		parts := rhsMarkupMdImage.FindStringSubmatch(match)
		return m.markdownImage(parts[1], parts[2], inTable)
	})
	s = rhsMarkupVideo.ReplaceAllString(s, "[$1]($1)")
	s = rhsMarkupOutside(s, rhsMarkupProtected, func(part string) string {
		part = rhsMarkupColor.ReplaceAllString(part, "")
		part = rhsMarkupYandexColor.ReplaceAllString(part, "$1")
		part = rhsMarkupYandexRed.ReplaceAllString(part, "$1")
		part = rhsMarkupReplacePaired(rhsMarkupYandexMono, part, "$1`$2`$3")
		part = rhsMarkupBareLink.ReplaceAllString(part, "[$1]($1)")
		part = rhsMarkupYandexLink.ReplaceAllStringFunc(part, func(match string) string {
			parts := rhsMarkupYandexLink.FindStringSubmatch(match)
			if parts[2] == "" {
				parts[2] = parts[1]
			}
			return fmt.Sprintf("[%s](%s)", strings.TrimSpace(parts[2]), parts[1])
		})
		part = rhsMarkupImage.ReplaceAllStringFunc(part, func(match string) string {
			parts := rhsMarkupImage.FindStringSubmatch(match)
			return parts[1] + m.imageRef(parts[2], match[len(parts[1]):], inTable)
		})
		part = rhsMarkupFileLink.ReplaceAllStringFunc(part, func(match string) string {
			return m.fileLink(rhsMarkupFileLink.FindStringSubmatch(match)[1], "")
		})
		part = rhsMarkupLink.ReplaceAllStringFunc(part, func(match string) string {
			parts := rhsMarkupLink.FindStringSubmatch(match)
			return m.wikiLink(match, strings.TrimSpace(parts[1]), strings.TrimSpace(parts[2]))
		})
		part = rhsMarkupMention.ReplaceAllString(part, "@$1")
		return part
	})
	s = rhsMarkupOutside(s, rhsMarkupProtectedURL, func(part string) string {
		part = rhsMarkupDelimited(part, '*', "**")
		part = rhsMarkupCite.ReplaceAllString(part, "*$1*")
		part = rhsMarkupReplacePaired(rhsMarkupYandexEm, part, "$1*$2*$3")
		part = rhsMarkupReplacePaired(rhsMarkupYandexDel, part, "$1~~$2~~$3")
		part = rhsMarkupReplacePaired(rhsMarkupYandexIns, part, "$1$2$3")
		part = rhsMarkupReplacePaired(rhsMarkupYandexMark, part, "$1**$2**$3")
		part = rhsMarkupDelimited(part, '-', "~~")
		part = rhsMarkupDelimited(part, '+', "")
		part = rhsMarkupDelimited(part, '^', "")
		part = rhsMarkupDelimited(part, '~', "")
		if inTable {
			return strings.ReplaceAll(part, `\\`, " ")
		}
		return strings.ReplaceAll(part, `\\`, "\n")
	})
	return s
}

// markdownImage handles ![alt](target): the target of a moved issue may point
// to the old tracker, so a picture is matched to the issue's files by name.
// Pictures from other sites stay links.
func (m *rhsMarkup) markdownImage(alt, target string, inTable bool) string {
	name := alt
	if name == "" {
		name = path.Base(strings.SplitN(target, "?", 2)[0])
	}
	file, known := m.files[alt]
	if !known {
		file, known = m.files[path.Base(strings.SplitN(target, "?", 2)[0])]
	}
	switch {
	case known && file.Image && !inTable:
		return fmt.Sprintf("![%s](%s)", rhsMarkupLabel(name), file.URL)
	case known:
		return fmt.Sprintf("[%s](%s)", rhsMarkupLabel(name), file.AbsoluteURL)
	case rhsMarkupLinkTarget.MatchString(target):
		return fmt.Sprintf("[%s](%s)", rhsMarkupLabel(name), target)
	}
	return name
}

func (m *rhsMarkup) imageRef(name, original string, inTable bool) string {
	name = strings.TrimSpace(name)
	if rhsMarkupLinkTarget.MatchString(name) {
		// Pictures from other sites stay links: opening a card must not call them.
		return fmt.Sprintf("[%s](%s)", path.Base(name), name)
	}
	file, known := m.files[name]
	switch {
	case known && file.Image && !inTable:
		return fmt.Sprintf("![%s](%s)", rhsMarkupLabel(name), file.URL)
	case known:
		return fmt.Sprintf("[%s](%s)", rhsMarkupLabel(name), file.AbsoluteURL)
	case rhsMarkupImageFile.MatchString(name):
		return name
	}
	return original
}

func (m *rhsMarkup) fileLink(name, text string) string {
	if text == "" {
		text = name
	}
	if file, known := m.files[name]; known {
		return fmt.Sprintf("[%s](%s)", rhsMarkupLabel(text), file.AbsoluteURL)
	}
	return text
}

func (m *rhsMarkup) wikiLink(original, text, target string) string {
	switch {
	case strings.HasPrefix(target, "^"):
		return m.fileLink(strings.TrimPrefix(target, "^"), text)
	case strings.HasPrefix(target, "~"), strings.HasPrefix(target, "#"):
		if text != "" {
			return text
		}
		return strings.TrimLeft(target, "~#")
	case rhsMarkupLinkTarget.MatchString(target):
		if text == "" {
			text = target
		}
		return fmt.Sprintf("[%s](%s)", text, target)
	}
	return original
}

func rhsMarkupLabel(s string) string {
	return strings.NewReplacer("[", "(", "]", ")").Replace(s)
}

// rhsMarkupDelimited replaces paired single delimiters at word boundaries, so
// that dates, hyphens and "a * b" stay as they are. Doubled delimiters are
// markdown already.
func rhsMarkupDelimited(s string, delimiter rune, replacement string) string {
	if !strings.ContainsRune(s, delimiter) {
		return s
	}
	runes := []rune(s)
	var b strings.Builder
	for i := 0; i < len(runes); i++ {
		if runes[i] == delimiter && rhsMarkupOpens(runes, i, delimiter) {
			if end := rhsMarkupCloses(runes, i+1, delimiter); end > 0 {
				b.WriteString(replacement)
				b.WriteString(string(runes[i+1 : end]))
				b.WriteString(replacement)
				i = end
				continue
			}
		}
		b.WriteRune(runes[i])
	}
	return b.String()
}

func rhsMarkupWordRune(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r)
}

func rhsMarkupOpens(runes []rune, i int, delimiter rune) bool {
	if i+1 >= len(runes) || unicode.IsSpace(runes[i+1]) || runes[i+1] == delimiter {
		return false
	}
	return i == 0 || (!rhsMarkupWordRune(runes[i-1]) && runes[i-1] != delimiter)
}

func rhsMarkupCloses(runes []rune, from int, delimiter rune) int {
	for j := from + 1; j < len(runes); j++ {
		if runes[j] != delimiter || unicode.IsSpace(runes[j-1]) || runes[j-1] == delimiter {
			continue
		}
		if j+1 == len(runes) || (!rhsMarkupWordRune(runes[j+1]) && runes[j+1] != delimiter) {
			return j
		}
	}
	return 0
}
