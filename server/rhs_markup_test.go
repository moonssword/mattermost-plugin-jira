// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"testing"

	jira "github.com/andygrunwald/go-jira"
	"github.com/stretchr/testify/assert"
)

func TestJiraTextToMarkdown(t *testing.T) {
	files := map[string]rhsMarkupFile{
		"shot.png": {URL: "/plugins/jira/api/v2/rhs/attachment?id=1", AbsoluteURL: "http://mm/plugins/jira/api/v2/rhs/attachment?id=1", Image: true},
		"log.txt":  {URL: "/x?id=2", AbsoluteURL: "http://mm/x?id=2"},
	}
	for name, tc := range map[string]struct{ in, out string }{
		"cyrillic bold":      {"это *жирный текст* здесь", "это **жирный текст** здесь"},
		"two bolds":          {"*а* и *б*", "**а** и **б**"},
		"markdown bold":      {"**уже** готово", "**уже** готово"},
		"not bold":           {"2 * 3 * 4", "2 * 3 * 4"},
		"strike":             {"было -старое- стало", "было ~~старое~~ стало"},
		"dates stay":         {"2026-01-02 и well-known", "2026-01-02 и well-known"},
		"underline":          {"+важно+ тут", "важно тут"},
		"monospace":          {"код {{a*b*c}}", "код `a*b*c`"},
		"heading":            {"h2. Заголовок", "## Заголовок"},
		"markdown heading":   {"## Заголовок", "## Заголовок"},
		"bullets":            {"* один\n** два\n- три", "- один\n    - два\n- три"},
		"numbered":           {"# один\n# два", "1. один\n1. два"},
		"link":               {"[сайт|https://a.b/c-d-e]", "[сайт](https://a.b/c-d-e)"},
		"bare link":          {"[https://a.b]", "[https://a.b](https://a.b)"},
		"markdown link":      {"[сайт](https://a.b/c)", "[сайт](https://a.b/c)"},
		"plain brackets":     {"[a|b]", "[a|b]"},
		"url untouched":      {"см. https://a.b/-x-/*y*", "см. https://a.b/-x-/*y*"},
		"email untouched":    {"пишите a-b-c@d.e", "пишите a-b-c@d.e"},
		"mention":            {"[~ivan@a.b], привет", "@ivan@a.b, привет"},
		"color":              {"{color:red}красный{color}", "красный"},
		"code":               {"{code:java}\nint *a* = 1;\n{code}", "```java\nint *a* = 1;\n```"},
		"code with title":    {"{code:title=x|language=go}a{code}", "```go\na\n```"},
		"noformat":           {"{noformat}*a*{noformat}", "```\n*a*\n```"},
		"markdown fence":     {"```\n*a*\n```", "```\n*a*\n```"},
		"quote":              {"{quote}\nстрока *а*\nещё\n{quote}", "> строка **а**\n> ещё"},
		"quote line":         {"bq. цитата", "> цитата"},
		"panel":              {"{panel:title=Итог|bgColor=#fff}текст{panel}", "> **Итог**\n>\n> текст"},
		"confluence warning": {"{warning}осторожно{warning}", "> ⚠️\n>\n> осторожно"},
		"rule":               {"а\n----\nб", "а\n\n---\n\nб"},
		"table":              {"||а||б||\n|1|2|", "| а | б |\n|---|---|\n| 1 | 2 |"},
		"table no header":    {"|1|2|", "|  |  |\n|---|---|\n| 1 | 2 |"},
		"table with link":    {"|[x|https://a.b]|2|", "|  |  |\n|---|---|\n| [x](https://a.b) | 2 |"},
		"markdown table":     {"| а |\n|---|\n| 1 |", "| а |\n|---|\n| 1 |"},
		"image":              {"!shot.png|thumbnail!", "![shot.png](/plugins/jira/api/v2/rhs/attachment?id=1)"},
		"image in table":     {"|!shot.png!|", "|  |\n|---|\n| [shot.png](http://mm/plugins/jira/api/v2/rhs/attachment?id=1) |"},
		"file as image":      {"!log.txt!", "[log.txt](http://mm/x?id=2)"},
		"lost image":         {"!gone.png!", "gone.png"},
		"outside image":      {"!https://a.b/c.png!", "[c.png](https://a.b/c.png)"},
		"file link":          {"[^log.txt]", "[log.txt](http://mm/x?id=2)"},
		"two quotes":         {"{quote}а{quote}\n\n{quote}б{quote}", "> а\n\n\u200b\n\n> б"},
		"two lists":          {"* а\n\n# б\n# в", "- а\n\n\u200b\n\n1. б\n1. в"},
		"exclamations":       {"Внимание! Это! важно", "Внимание! Это! важно"},
	} {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.out, jiraTextToMarkdown(tc.in, files))
		})
	}
}

func TestJiraTextToMarkdownYandex(t *testing.T) {
	files := map[string]rhsMarkupFile{
		"shot.png": {URL: "/rhs/attachment?id=1", AbsoluteURL: "http://mm/rhs/attachment?id=1", Image: true},
	}
	for name, tc := range map[string]struct{ in, out string }{
		// Documented YFM.
		"mono":          {"код ##a*b*## тут", "код `a*b*` тут"},
		"underline":     {"++важно++ тут", "важно тут"},
		"highlight":     {"==важно== тут", "**важно** тут"},
		"color":         {"{green}(зелёный) и {orange}(оранж)", "зелёный и оранж"},
		"fold heading":  {"##+ Заголовок", "## Заголовок"},
		"anchor":        {"#### Заголовок {#level4}", "#### Заголовок"},
		"paren list":    {"1) раз\n2) два", "1. раз\n2. два"},
		"nested md":     {"- раз\n  - два", "- раз\n  - два"},
		"checklist":     {"[ ] дело\n[x] готово", "☐ дело\n☑ готово"},
		"hidden":        {"[//]: # (скрыто)\nвидно", "видно"},
		"note":          {"{% note warning \"Осторожно\" %}\n\nтекст\n\n{% endnote %}", "> ⚠️ **Осторожно**\n>\n> текст"},
		"note no title": {"{% note info %}\nтекст\n{% endnote %}", "> ℹ️\n>\n> текст"},
		"cut":           {"{% cut \"Подробнее\" %}\nтекст\n{% endcut %}", "> **Подробнее**\n>\n> текст"},
		"table": {"#|\n|:{header-rows=\"1\"}\n|| а | б ||\n|| 1 | 2\nстрока ||\n|#",
			"| а | б |\n|---|---|\n| 1 | 2 строка |"},
		"table no header": {"#|\n|| 1 | ^ ||\n|#", "|  |  |\n|---|---|\n| 1 |  |"},
		"image size":      {"![схема](https://a.b/c.png =700x)", "[схема](https://a.b/c.png)"},
		"image attrs":     {"![подпись](https://a.b/c.png \"t\"){width=100}", "[подпись](https://a.b/c.png)"},
		"moved image":     {"![shot.png](/ajax/v2/attachments/1?inline=true =700x)", "![shot.png](/rhs/attachment?id=1)"},
		"lost image":      {"![gone.png](/ajax/v2/attachments/2)", "gone.png"},
		"video":           {"@[vk](https://vk.com/v)", "[https://vk.com/v](https://vk.com/v)"},

		// Older wiki markup.
		"old italic":   {"это //курсив// тут", "это *курсив* тут"},
		"old strike":   {"это --старое-- тут", "это ~~старое~~ тут"},
		"old heading":  {"== Заголовок", "# Заголовок"},
		"old heading2": {"=== Заголовок ===", "## Заголовок"},
		"old link":     {"((https://a.b/c текст ссылки))", "[текст ссылки](https://a.b/c)"},
		"old bare":     {"((https://a.b))", "[https://a.b](https://a.b)"},
		"old code":     {"%%(python)\nprint(1)\n%%", "```python\nprint(1)\n```"},
		"old inline":   {"код %%a*b*%% тут", "код `a*b*` тут"},
		"old quote":    {"<[цитата]>", "> цитата"},
		"old cut":      {"<{Подробнее\nтекст}>", "> **Подробнее**\n>\n> текст"},
		"old red":      {"!!(red)важно!! и !!тоже!!", "важно и тоже"},

		// The dialects do not get in each other's way.
		"path":            {"/usr//lib и a--b и 2 == 3 == 4", "/usr//lib и a--b и 2 == 3 == 4"},
		"url with slash":  {"см. https://a.b//c//d", "см. https://a.b//c//d"},
		"comment slashes": {"// TODO fix //", "// TODO fix //"},
		"wiki dash list":  {"- раз\n-- вложенный", "- раз\n    - вложенный"},
		"wiki table":      {"||а||\n|1|", "| а |\n|---|\n| 1 |"},
		"shouting":        {"Ура!! Да!!", "Ура!! Да!!"},
		"percents":        {"скидка 10%", "скидка 10%"},
	} {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.out, jiraTextToMarkdown(tc.in, files))
		})
	}
}

func TestBuildBoardFilterJQL(t *testing.T) {
	categories := map[string]bool{statusCategoryKeyDone: true}
	kanban := &rhsBoardScope{jql: "filter = 7"}
	scrum := &rhsBoardScope{jql: "filter = 7 AND (a = 1)", scrum: true}

	jql, err := buildBoardFilterJQL(scrum, RHSFilterBoard, rhsDefaultSort, categories)
	assert.NoError(t, err)
	assert.Contains(t, jql, "filter = 7 AND (a = 1) AND sprint in openSprints() ORDER BY")

	jql, err = buildBoardFilterJQL(kanban, RHSFilterBoard, rhsDefaultSort, categories)
	assert.NoError(t, err)
	assert.Contains(t, jql, "filter = 7 AND (statusCategory != done OR (statusCategory = done AND updated >= -14d)) ORDER BY")

	jql, err = buildBoardFilterJQL(kanban, RHSFilterAssigned, rhsDefaultSort, categories)
	assert.NoError(t, err)
	assert.Contains(t, jql, "filter = 7 AND assignee = currentUser() AND statusCategory != done ORDER BY")

	_, err = buildFilterJQL(RHSFilterBoard, rhsDefaultSort, categories)
	assert.ErrorIs(t, err, ErrInvalidRHSFilter)
}

func TestRHSNewestAttachments(t *testing.T) {
	sorted := rhsNewestAttachments([]*jira.Attachment{
		{ID: "1", Filename: "old.png", Created: "2026-01-01T10:00:00.000+0300"},
		nil,
		{ID: "3", Filename: "same.png", Created: "2026-03-01T10:00:00.000+0300"},
		{ID: "4", Filename: "same.png", Created: "2026-03-01T10:00:00.000+0300"},
		{ID: "2", Filename: "utc.png", Created: "2026-02-01T10:00:00.000+0000"},
		{ID: ""},
	})
	ids := []string{}
	for _, a := range sorted {
		ids = append(ids, a.ID)
	}
	assert.Equal(t, []string{"4", "3", "2", "1"}, ids)
}
