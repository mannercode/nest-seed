#!/usr/bin/env node
/**
 * Jest spec 파일에서 describe/it 트리를 추출해 출력한다.
 * 테스트 구조를 확인할 때 쓴다. TypeScript compiler API로 AST를 읽으므로
 * 여러 줄 문자열, template literal, it.each도 안전하게 다룬다.
 *
 *   node tools/dev-tools/list-tests.js                       # 기본값: libs/ 트리
 *   node tools/dev-tools/list-tests.js apps/api              # 다른 경로
 *   node tools/dev-tools/list-tests.js --md > tests.md       # Markdown으로 출력
 *   node tools/dev-tools/list-tests.js --html > tests.html   # 브라우저용 (펼치기/접기/검색)
 *   node tools/dev-tools/list-tests.js --todos-only          # it.todo만
 *   node tools/dev-tools/list-tests.js --no-todos            # 구현된 it만
 *   node tools/dev-tools/list-tests.js --json                # 기계가 읽는 형식
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const targets = args.filter((a) => !a.startsWith('--'))
const roots = targets.length > 0 ? targets : ['libs']

const renderMarkdown = flags.has('--md') || flags.has('--markdown')
const renderJson = flags.has('--json')
const renderHtml = flags.has('--html')
const todosOnly = flags.has('--todos-only')
const noTodos = flags.has('--no-todos')

function findSpecFiles(dirs) {
    const specs = []
    function walk(d) {
        let entries
        try {
            entries = fs.readdirSync(d, { withFileTypes: true })
        } catch {
            return
        }
        for (const entry of entries) {
            const p = path.join(d, entry.name)
            if (entry.isDirectory()) {
                if (
                    entry.name === 'node_modules' ||
                    entry.name === '_output' ||
                    entry.name.startsWith('.')
                ) {
                    continue
                }
                walk(p)
            } else if (entry.isFile() && entry.name.endsWith('.spec.ts')) {
                specs.push(p)
            }
        }
    }
    for (const d of dirs) walk(d)
    return specs.sort()
}

// Jest 전역 함수와 변형(each, todo, skip, only)을 구분한다.
function classifyCallExpression(node, sourceFile) {
    const callee = node.expression

    // 1) Identifier 호출: describe, it, test, xdescribe, fdescribe 등.
    if (ts.isIdentifier(callee)) {
        const n = callee.text
        if (n === 'describe' || n === 'xdescribe' || n === 'fdescribe') return 'describe'
        if (n === 'it' || n === 'test' || n === 'xit' || n === 'fit' || n === 'xtest') return 'it'
        return null
    }

    // 2) PropertyAccess 호출: describe.skip, it.todo, it.only, it.each 등.
    if (ts.isPropertyAccessExpression(callee)) {
        const obj = callee.expression
        const prop = callee.name.text
        if (!ts.isIdentifier(obj)) return null
        const base =
            obj.text === 'describe'
                ? 'describe'
                : obj.text === 'it' || obj.text === 'test'
                  ? 'it'
                  : null
        if (!base) return null
        if (prop === 'todo') return 'it.todo' // describe.todo는 Jest에 없음
        if (prop === 'each' || prop === 'concurrent' || prop === 'skip' || prop === 'only')
            return base
        return null
    }

    // 3) CallExpression 호출: describe.each([...])(...), it.each([...])(...).
    if (ts.isCallExpression(callee)) {
        const inner = callee.expression
        if (ts.isPropertyAccessExpression(inner)) {
            const innerObj = inner.expression
            const innerProp = inner.name.text
            if (ts.isIdentifier(innerObj) && innerProp === 'each') {
                if (innerObj.text === 'describe') return 'describe'
                if (innerObj.text === 'it' || innerObj.text === 'test') return 'it'
            }
        }
        return null
    }

    return null
}

function descriptionFromArg(arg, sourceFile) {
    if (!arg) return ''
    if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return arg.text
    // 값이 끼어든 template literal은 원문을 그대로 보여 준다.
    if (ts.isTemplateExpression(arg)) {
        return sourceFile.text.slice(arg.getStart(sourceFile), arg.getEnd())
    }
    return sourceFile.text.slice(arg.getStart(sourceFile), arg.getEnd())
}

function parseSpecFile(filePath) {
    const source = fs.readFileSync(filePath, 'utf8')
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true)
    const root = []

    function visit(node, stack) {
        if (ts.isCallExpression(node)) {
            const kind = classifyCallExpression(node, sourceFile)
            if (kind) {
                const description = descriptionFromArg(node.arguments[0], sourceFile)
                const entry = { kind, description, children: [] }
                stack[stack.length - 1].push(entry)
                if (kind === 'describe') {
                    stack.push(entry.children)
                    ts.forEachChild(node, (child) => visit(child, stack))
                    stack.pop()
                    return
                }
                // it과 it.todo의 함수 본문은 더 내려가지 않는다.
                return
            }
        }
        ts.forEachChild(node, (child) => visit(child, stack))
    }

    visit(sourceFile, [root])
    return root
}

function filterTree(tree) {
    const out = []
    for (const item of tree) {
        if (item.kind === 'describe') {
            const filteredChildren = filterTree(item.children)
            if (filteredChildren.length > 0) {
                out.push({ ...item, children: filteredChildren })
            }
        } else if (item.kind === 'it.todo') {
            if (!noTodos) out.push(item)
        } else {
            // 일반 it이다.
            if (!todosOnly) out.push(item)
        }
    }
    return out
}

function summarize(tree, acc = { it: 0, todo: 0, describe: 0 }) {
    for (const item of tree) {
        if (item.kind === 'describe') {
            acc.describe++
            summarize(item.children, acc)
        } else if (item.kind === 'it.todo') {
            acc.todo++
        } else {
            acc.it++
        }
    }
    return acc
}

function renderTree(tree, indent = 1, lines = []) {
    for (const item of tree) {
        const prefix = '  '.repeat(indent)
        const tag =
            item.kind === 'describe'
                ? 'describe'
                : item.kind === 'it.todo'
                  ? 'todo    '
                  : 'it      '
        lines.push(`${prefix}${tag} ${item.description}`)
        if (item.children.length > 0) renderTree(item.children, indent + 1, lines)
    }
    return lines
}

function renderMd(tree, depth = 3, lines = []) {
    for (const item of tree) {
        if (item.kind === 'describe') {
            lines.push(`${'#'.repeat(Math.min(depth, 6))} ${item.description}`)
            if (item.children.length > 0) renderMd(item.children, depth + 1, lines)
        } else {
            const marker = item.kind === 'it.todo' ? '- [ ] *(todo)* ' : '- [x] '
            lines.push(`${marker}${item.description}`)
        }
    }
    return lines
}

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => HTML_ESCAPE[c])
}

function renderHtmlNode(item) {
    if (item.kind === 'describe') {
        const stat = summarize(item.children)
        const meta = []
        if (stat.it > 0) meta.push(`<span class="badge badge-it">${stat.it}</span>`)
        if (stat.todo > 0) meta.push(`<span class="badge badge-todo">${stat.todo}</span>`)
        const children = item.children.map(renderHtmlNode).join('')
        return (
            `<details class="node node-describe" open>` +
            `<summary><span class="kind">describe</span>` +
            `<span class="desc">${esc(item.description)}</span>` +
            `<span class="meta">${meta.join('')}</span></summary>` +
            `<div class="children">${children}</div>` +
            `</details>`
        )
    }
    const cls = item.kind === 'it.todo' ? 'todo' : 'it'
    const label = item.kind === 'it.todo' ? 'todo' : 'it'
    return (
        `<div class="node node-leaf node-${cls}">` +
        `<span class="kind kind-${cls}">${label}</span>` +
        `<span class="desc">${esc(item.description)}</span>` +
        `</div>`
    )
}

function renderHtmlDocument(collected, totals, rootsLabel) {
    const fileBlocks = collected
        .map(({ file, tree }) => {
            const stat = summarize(tree)
            const children = tree.map(renderHtmlNode).join('')
            return (
                `<details class="node node-file" open>` +
                `<summary><span class="kind kind-file">file</span>` +
                `<span class="desc filename">${esc(file)}</span>` +
                `<span class="meta">` +
                `<span class="badge badge-it">${stat.it} test</span>` +
                (stat.todo > 0 ? `<span class="badge badge-todo">${stat.todo} todo</span>` : '') +
                `</span></summary>` +
                `<div class="children">${children}</div>` +
                `</details>`
            )
        })
        .join('\n')

    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>테스트 항목 — ${esc(rootsLabel)}</title>
<style>
*, *::before, *::after { box-sizing: border-box; }
body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Pretendard", "Noto Sans KR", sans-serif;
    background: #f6f7f9;
    color: #1f2328;
    line-height: 1.5;
}
header {
    position: sticky; top: 0; z-index: 10;
    background: #ffffff;
    border-bottom: 1px solid #d0d7de;
    padding: 12px 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
header h1 { margin: 0 0 8px; font-size: 16px; font-weight: 600; }
header h1 .root { color: #57606a; font-weight: 400; font-size: 13px; margin-left: 8px; }
.totals { font-size: 13px; color: #57606a; margin-bottom: 10px; }
.totals strong { color: #1f2328; font-weight: 600; }
.controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.controls button {
    font: inherit; font-size: 13px;
    padding: 5px 12px; border-radius: 6px;
    border: 1px solid #d0d7de; background: #f6f8fa; color: #1f2328;
    cursor: pointer;
}
.controls button:hover { background: #eaeef2; }
.controls input[type=search] {
    font: inherit; font-size: 13px;
    padding: 5px 10px; border-radius: 6px;
    border: 1px solid #d0d7de; min-width: 220px;
}
.controls label { font-size: 13px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
main { padding: 16px 20px 60px; }
details > summary { list-style: none; cursor: pointer; }
details > summary::-webkit-details-marker { display: none; }
.node { margin: 1px 0; }
summary, .node-leaf {
    display: flex; align-items: baseline; gap: 8px;
    padding: 3px 6px; border-radius: 4px;
    font-size: 13.5px;
}
summary:hover { background: #eaeef2; }
.node-leaf:hover { background: #eaeef2; }
summary::before {
    content: "▸"; display: inline-block;
    width: 12px; color: #8c959f; transition: transform 0.1s;
    flex-shrink: 0;
}
details[open] > summary::before { transform: rotate(90deg); }
.node-leaf::before {
    content: "•"; display: inline-block;
    width: 12px; color: #8c959f; flex-shrink: 0;
}
.children { margin-left: 18px; border-left: 1px solid #eaeef2; padding-left: 6px; }
.kind {
    font-family: ui-monospace, SFMono-Regular, "Menlo", monospace;
    font-size: 11px; padding: 1px 6px; border-radius: 3px;
    flex-shrink: 0; line-height: 1.6;
}
.kind-file { background: #ddf4ff; color: #0969da; }
.node-describe > summary > .kind { background: #fbf0e6; color: #9a6700; }
.kind-it { background: #dafbe1; color: #1a7f37; }
.kind-todo { background: #fff8c5; color: #9a6700; }
.desc {
    font-family: ui-monospace, SFMono-Regular, "Menlo", monospace;
    font-size: 13px; word-break: break-word;
}
.filename { color: #0969da; font-weight: 500; }
.node-todo .desc { color: #9a6700; }
.meta { margin-left: auto; display: flex; gap: 4px; flex-shrink: 0; padding-left: 8px; }
.badge {
    font-size: 11px; padding: 0 8px; border-radius: 10px;
    font-family: ui-monospace, SFMono-Regular, "Menlo", monospace;
    line-height: 18px;
}
.badge-it { background: #dafbe1; color: #1a7f37; }
.badge-todo { background: #fff8c5; color: #9a6700; }
.hidden { display: none !important; }
.match-highlight { background: #fff3a8; border-radius: 2px; padding: 0 1px; }
.empty-state { padding: 40px 20px; text-align: center; color: #8c959f; font-size: 14px; }
</style>
</head>
<body>
<header>
    <h1>테스트 항목 <span class="root">${esc(rootsLabel)}</span></h1>
    <div class="totals">
        <strong>${totals.it}</strong> test ·
        <strong>${totals.todo}</strong> todo ·
        <strong>${totals.describe}</strong> describe ·
        <strong>${collected.length}</strong> files
    </div>
    <div class="controls">
        <input type="search" id="q" placeholder="검색 (describe / it / todo / 파일명)" autocomplete="off">
        <button id="expand-all">전체 펼치기</button>
        <button id="collapse-all">전체 접기</button>
        <button id="files-only">파일만 보기</button>
        <label><input type="checkbox" id="show-it" checked> test</label>
        <label><input type="checkbox" id="show-todo" checked> todo</label>
        <span id="count" style="margin-left:auto; font-size:12px; color:#57606a;"></span>
    </div>
</header>
<main id="tree">
${fileBlocks}
<div id="empty" class="empty-state hidden">검색 결과가 없다.</div>
</main>
<script>
(function () {
    const tree = document.getElementById('tree')
    const empty = document.getElementById('empty')
    const q = document.getElementById('q')
    const showIt = document.getElementById('show-it')
    const showTodo = document.getElementById('show-todo')
    const countEl = document.getElementById('count')

    document.getElementById('expand-all').addEventListener('click', () => {
        tree.querySelectorAll('details').forEach((d) => (d.open = true))
    })
    document.getElementById('collapse-all').addEventListener('click', () => {
        tree.querySelectorAll('details').forEach((d) => (d.open = false))
    })
    document.getElementById('files-only').addEventListener('click', () => {
        tree.querySelectorAll('details.node-file').forEach((d) => (d.open = false))
        tree.querySelectorAll('details.node-describe').forEach((d) => (d.open = true))
    })

    function clearHighlights() {
        tree.querySelectorAll('.match-highlight').forEach((el) => {
            const parent = el.parentNode
            parent.replaceChild(document.createTextNode(el.textContent), el)
            parent.normalize()
        })
    }

    function highlightIn(el, needle) {
        const re = new RegExp(needle.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'gi')
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
        const targets = []
        let n
        while ((n = walker.nextNode())) {
            if (n.parentElement.classList.contains('kind')) continue
            if (n.parentElement.classList.contains('badge')) continue
            if (re.test(n.nodeValue)) targets.push(n)
            re.lastIndex = 0
        }
        for (const text of targets) {
            const frag = document.createDocumentFragment()
            let last = 0
            const value = text.nodeValue
            re.lastIndex = 0
            let m
            while ((m = re.exec(value))) {
                if (m.index > last) frag.appendChild(document.createTextNode(value.slice(last, m.index)))
                const span = document.createElement('span')
                span.className = 'match-highlight'
                span.textContent = m[0]
                frag.appendChild(span)
                last = m.index + m[0].length
            }
            if (last < value.length) frag.appendChild(document.createTextNode(value.slice(last)))
            text.parentNode.replaceChild(frag, text)
        }
    }

    function descText(node) {
        const d = node.matches('summary')
            ? node.querySelector(':scope > .desc')
            : node.querySelector(':scope > .desc')
        return d ? d.textContent.toLowerCase() : ''
    }

    function applyFilter() {
        clearHighlights()
        const needle = q.value.trim().toLowerCase()
        const wantIt = showIt.checked
        const wantTodo = showTodo.checked
        let visibleLeaves = 0

        // 1차: leaf 노드를 먼저 거른다.
        tree.querySelectorAll('.node-leaf').forEach((leaf) => {
            const isTodo = leaf.classList.contains('node-todo')
            const typeOk = isTodo ? wantTodo : wantIt
            const text = leaf.querySelector(':scope > .desc').textContent.toLowerCase()
            const textOk = needle === '' || text.includes(needle)
            const visible = typeOk && textOk
            leaf.classList.toggle('hidden', !visible)
            if (visible) visibleLeaves++
        })

        // 2차: describe는 자식이 보이거나 자기 설명이 검색어와 맞으면 보인다.
        const describes = Array.from(tree.querySelectorAll('details.node-describe')).reverse()
        describes.forEach((d) => {
            const ownText = d.querySelector(':scope > summary > .desc').textContent.toLowerCase()
            const ownMatches = needle !== '' && ownText.includes(needle)
            const hasVisibleChild = d.querySelector(':scope > .children > .node:not(.hidden)') !== null
            const visible = ownMatches || hasVisibleChild
            d.classList.toggle('hidden', !visible)
            if (needle !== '' && visible) d.open = true
        })

        // 3차: 파일 노드를 거른다.
        let visibleFiles = 0
        tree.querySelectorAll('details.node-file').forEach((f) => {
            const fileText = f.querySelector(':scope > summary > .desc').textContent.toLowerCase()
            const fileMatches = needle !== '' && fileText.includes(needle)
            const hasVisibleChild = f.querySelector(':scope > .children > .node:not(.hidden)') !== null
            const visible = fileMatches || hasVisibleChild
            f.classList.toggle('hidden', !visible)
            if (needle !== '' && visible) f.open = true
            if (visible) visibleFiles++
        })

        if (needle) highlightIn(tree, needle)

        countEl.textContent = needle || !wantIt || !wantTodo
            ? visibleLeaves + ' 항목 / ' + visibleFiles + ' 파일'
            : ''
        empty.classList.toggle('hidden', visibleFiles > 0)
    }

    q.addEventListener('input', applyFilter)
    showIt.addEventListener('change', applyFilter)
    showTodo.addEventListener('change', applyFilter)

    // '/' 키로 검색창에 바로 포커스한다.
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== q) {
            e.preventDefault()
            q.focus()
            q.select()
        } else if (e.key === 'Escape' && document.activeElement === q) {
            q.value = ''
            applyFilter()
            q.blur()
        }
    })
})()
</script>
</body>
</html>
`
}

const files = findSpecFiles(roots)
const collected = []
for (const file of files) {
    const tree = filterTree(parseSpecFile(file))
    if (tree.length === 0) continue
    collected.push({ file, tree })
}

if (renderJson) {
    process.stdout.write(JSON.stringify(collected, null, 2) + '\n')
    process.exit(0)
}

let totalIt = 0
let totalTodo = 0
let totalDescribe = 0

if (renderHtml) {
    for (const { tree } of collected) {
        const stat = summarize(tree)
        totalIt += stat.it
        totalTodo += stat.todo
        totalDescribe += stat.describe
    }
    process.stdout.write(
        renderHtmlDocument(
            collected,
            { it: totalIt, todo: totalTodo, describe: totalDescribe },
            roots.join(', ')
        )
    )
    process.exit(0)
}

if (renderMarkdown) {
    process.stdout.write(`# 테스트 항목 (${roots.join(', ')})\n\n`)
    for (const { file, tree } of collected) {
        const stat = summarize(tree)
        totalIt += stat.it
        totalTodo += stat.todo
        totalDescribe += stat.describe
        process.stdout.write(`\n## ${file}\n\n`)
        process.stdout.write(`*${stat.it} test, ${stat.todo} todo, ${stat.describe} describe*\n\n`)
        for (const line of renderMd(tree)) {
            process.stdout.write(`${line}\n`)
        }
    }
    process.stdout.write(
        `\n---\n\n**합계**: ${totalIt} test, ${totalTodo} todo, ${totalDescribe} describe (across ${collected.length} files)\n`
    )
} else {
    for (const { file, tree } of collected) {
        const stat = summarize(tree)
        totalIt += stat.it
        totalTodo += stat.todo
        totalDescribe += stat.describe
        process.stdout.write(`\n${file}  [${stat.it} test, ${stat.todo} todo]\n`)
        for (const line of renderTree(tree)) {
            process.stdout.write(`${line}\n`)
        }
    }
    process.stdout.write(
        `\n합계: ${totalIt} test, ${totalTodo} todo, ${totalDescribe} describe (across ${collected.length} files)\n`
    )
}
