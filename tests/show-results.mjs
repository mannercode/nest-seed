import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const testsDirectory = dirname(fileURLToPath(import.meta.url))
const mode = process.argv[2]

if (mode !== 'test' && mode !== 'atoz') {
    throw new Error('usage: node tests/show-results.mjs <test|atoz>')
}

const baseSuites = [
    { name: '공용 라이브러리', reason: '공통 도메인·인프라 헬퍼의 단위/통합 동작과 coverage 계약' },
    {
        name: 'Nest API',
        reason: '도메인·서비스·저장소·Restate 흐름의 단위/통합 동작과 coverage 계약'
    },
    { name: '개발 도구', reason: '터널 접근 정책과 Vitest 실행 자원 격리 헬퍼 계약' },
    {
        name: 'API race contracts',
        reason: '분산 시나리오가 사용하는 HTTP/SSE deadline과 workflow 목록 계약'
    },
    {
        name: 'Web contracts',
        reason: 'Console·User app BFF의 proxy/refresh 보안 경계와 프런트 린트 계약'
    }
]

const atozOnlySuites = [
    { name: '저장소 설정', reason: 'devcontainer·Dependabot·workflow 등 실행 환경 계약' },
    {
        name: 'Web browser E2E',
        reason: '관리자·사용자 로그인, 세션 보안, CRUD와 개인화 사용자 흐름'
    },
    {
        name: 'Web application builds',
        reason: 'Console·User app의 타입·lint 계약과 production build 가능 여부'
    },
    { name: '루트 정적 검사', reason: 'Markdown 링크·포맷과 shell 문법 계약' },
    { name: '배포 검증', reason: '빌드 결과와 실제 배포 스택의 API·문서·프록시 계약' }
]

const excludedSuites = [
    {
        name: 'API race scenarios',
        reason: '4-replica 장시간 경합 검증은 Stability 또는 전용 runner에서 실행'
    },
    { name: 'API benchmark', reason: 'RPS·latency 비교 측정은 합격선 없는 수동 benchmark' }
]

function readBrowserResult() {
    const junitPath = join(testsDirectory, 'web', '_output', 'junit.xml')
    if (!existsSync(junitPath)) return undefined

    const xml = readFileSync(junitPath, 'utf8')
    const root = xml.match(/<testsuites\b[^>]*>/)?.[0]
    if (!root) return undefined

    const value = (name) => root.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1]
    return {
        failures: Number(value('failures') ?? 0),
        skipped: Number(value('skipped') ?? 0),
        tests: Number(value('tests') ?? 0),
        time: Number(value('time') ?? 0)
    }
}

const browserResult = mode === 'atoz' ? readBrowserResult() : undefined
const passedSuites = mode === 'atoz' ? [...baseSuites, ...atozOnlySuites] : baseSuites
const notRunSuites = mode === 'atoz' ? excludedSuites : [...atozOnlySuites, ...excludedSuites]

const width = 88
const rule = '='.repeat(width)
const thinRule = '-'.repeat(width)
const command = mode === 'atoz' ? 'pnpm run atoz' : 'pnpm test'

console.log('')
console.log(rule)
console.log(` ${command} 결과: PASS`)
console.log(rule)
for (const suite of passedSuites) {
    let detail = suite.reason
    if (suite.name === 'Web browser E2E' && browserResult) {
        detail += ` (${browserResult.tests} tests, ${browserResult.time.toFixed(1)}s)`
        if (browserResult.failures > 0) detail += `, ${browserResult.failures} failed`
        if (browserResult.skipped > 0) detail += `, ${browserResult.skipped} skipped`
    }
    console.log(` PASS  ${suite.name}`)
    console.log(`       ${detail}`)
}

console.log(thinRule)
console.log(' 이 명령에 포함되지 않음')
for (const suite of notRunSuites) {
    console.log(`   - ${suite.name}: ${suite.reason}`)
}

if (mode === 'atoz') {
    const reportPath = join(testsDirectory, 'web', '_output', 'report', 'index.html')
    if (existsSync(reportPath)) {
        console.log(thinRule)
        console.log(` 브라우저 상세 보고서: ${reportPath}`)
        console.log(' 열기: pnpm run e2e:report')
    }
}
console.log(rule)
console.log('')

if (process.env.GITHUB_STEP_SUMMARY && existsSync(process.env.GITHUB_STEP_SUMMARY)) {
    const rows = passedSuites
        .map((suite) => `| PASS | ${suite.name} | ${suite.reason} |`)
        .join('\n')
    const excluded = notRunSuites.map((suite) => `- **${suite.name}** — ${suite.reason}`).join('\n')
    const markdown = [
        `## ${command} 결과: PASS`,
        '',
        '| 결과 | 영역 | 검증 이유 |',
        '| --- | --- | --- |',
        rows,
        '',
        '### 이 명령에 포함되지 않음',
        '',
        excluded,
        ''
    ].join('\n')
    try {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown)
    } catch (error) {
        console.warn(`GitHub Job Summary를 기록하지 못했습니다: ${error.message}`)
    }
}
