import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const testsDirectory = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = join(testsDirectory, '..')
const reportDirectory = join(workspaceRoot, '_output', 'test-reports')

// 순서는 기존 pnpm recursive 실행의 topological 순서와 같다.
const workspaceChecks = [
    {
        directory: 'libs/testing',
        area: '테스트 지원 라이브러리',
        reason: '공통 HTTP client와 테스트 fixture의 동작'
    },
    {
        directory: 'libs/common',
        area: '공용 라이브러리',
        reason: '공통 도메인·인프라 helper의 단위/통합 동작과 coverage 계약'
    },
    {
        directory: 'tests/api-race',
        area: 'API race 계약',
        reason: '분산 시나리오가 공유하는 HTTP/SSE deadline과 workflow 목록'
    },
    {
        directory: 'tests/web',
        area: 'Web 계약',
        atozArea: 'Web 계약과 browser E2E',
        reason: 'Console·User app BFF의 보안 경계',
        atozReason: 'BFF 보안 계약과 로그인·CRUD·세션 브라우저 흐름'
    },
    {
        directory: 'tools/dev-tools',
        area: '개발 도구',
        reason: 'Cloudflare 임시 tunnel의 접근 정책'
    },
    {
        directory: 'tools/vitest-helpers',
        area: 'Vitest 자원 격리',
        reason: '병렬 테스트의 Mongo·S3·Redis 자원 범위와 안전한 정리'
    },
    {
        directory: 'apps/api',
        area: 'Nest API',
        reason: '도메인·서비스·저장소·Restate 단위/통합 동작과 coverage 계약',
        atozReason: 'type/lint, 문서 redaction, Vitest 격리와 API 테스트·coverage 계약'
    },
    {
        directory: 'apps/console',
        area: 'Console build',
        atozReason: '관리자 앱의 type/lint와 production build'
    },
    {
        directory: 'apps/user-app',
        area: 'User app build',
        atozReason: '사용자 앱의 type/lint와 production build'
    }
]

const notIncluded = {
    test: [
        '브라우저 E2E와 Web production build — AtoZ 또는 전용 명령',
        '루트 정적 검사와 배포 검증 — AtoZ',
        '실제 API race와 benchmark — 각각의 전용 명령'
    ],
    atoz: [
        '실제 API race — Stability 또는 `pnpm run race <scenario>`',
        'API benchmark — 합격선 없는 수동 비교 측정'
    ]
}

function formatCommand(command, args) {
    return [command, ...args]
        .map((word) => (/^[A-Za-z0-9_./:@=+-]+$/.test(word) ? word : JSON.stringify(word)))
        .join(' ')
}

function execute(command, args) {
    console.log(`$ ${formatCommand(command, args)}`)
    return new Promise((resolvePromise, reject) => {
        const child = spawn(command, args, {
            cwd: workspaceRoot,
            env: process.env,
            stdio: 'inherit'
        })
        child.once('error', reject)
        child.once('exit', (code, signal) => {
            if (signal) console.error(`${command} 종료 신호: ${signal}`)
            resolvePromise(code ?? 1)
        })
    })
}

function stage(area, reason, command, args) {
    return {
        area,
        reason,
        command: formatCommand(command, args),
        run: () => execute(command, args)
    }
}

function workspaceStage(workspace, script) {
    return stage(
        script === 'atoz' ? (workspace.atozArea ?? workspace.area) : workspace.area,
        script === 'atoz' ? (workspace.atozReason ?? workspace.reason) : workspace.reason,
        'pnpm',
        ['--dir', workspace.directory, 'run', script]
    )
}

function installStage() {
    return {
        area: '의존성 설치',
        reason: 'lockfile 설치 검증; 일시적 registry 오류는 최대 5회 재시도',
        command: 'pnpm install --frozen-lockfile (최대 5회)',
        async run() {
            for (let attempt = 1; attempt <= 5; attempt += 1) {
                const exitCode = await execute('pnpm', ['install', '--frozen-lockfile'])
                if (exitCode === 0 || attempt === 5) return exitCode

                const waitSeconds = attempt * 10
                console.warn(`설치 ${attempt}/5회 실패 — ${waitSeconds}초 뒤 다시 시도합니다.`)
                await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000))
            }
        }
    }
}

function stagesFor(mode, extraArguments) {
    if (mode === 'test') {
        return [
            stage(
                '테스트 사전 build',
                '소비자가 실제 package output을 쓰도록 공용 라이브러리를 먼저 build',
                'pnpm',
                [
                    '--recursive',
                    '--filter',
                    './libs/**',
                    '--workspace-concurrency=1',
                    '--fail-if-no-match',
                    'run',
                    'build'
                ]
            ),
            ...workspaceChecks
                .filter((workspace) => workspace.reason)
                .map((workspace) => workspaceStage(workspace, 'test'))
        ]
    }

    if (mode === 'atoz') {
        return [
            stage('생성물 정리', '이전 build·coverage·테스트 결과 제거', 'pnpm', ['run', 'clean']),
            stage('로컬 인프라 초기화', 'MongoDB·Redis·NATS·Restate를 깨끗한 상태로 기동', 'bash', [
                'infra/reset.sh'
            ]),
            installStage(),
            stage(
                '저장소 설정 계약',
                'devcontainer·의존성·workflow·build·lint 설정의 안전장치',
                'pnpm',
                ['run', 'test:config']
            ),
            ...workspaceChecks.map((workspace) => workspaceStage(workspace, 'atoz')),
            stage('루트 정적 검사', '전체 포맷, Markdown 링크와 shell 문법', 'pnpm', [
                'run',
                'lint:root'
            ]),
            stage('배포 검증', '실제 스택의 API·문서·proxy와 Restate 재시작 replay 계약', 'bash', [
                'deploy/verify.sh'
            ])
        ]
    }

    if (mode === 'e2e') {
        return [
            stage(
                'Web browser E2E',
                '관리자·사용자 로그인, 세션 보안, CRUD와 개인화 흐름',
                'pnpm',
                ['--filter', './tests/web', '--fail-if-no-match', 'run', 'e2e', ...extraArguments]
            )
        ]
    }

    if (mode === 'race') {
        const scenario = extraArguments[0]
        return [
            stage(
                `API race: ${scenario}`,
                '4-replica 배포 스택의 분산 경합·fanout·장애 복구 불변식',
                'bash',
                ['tests/api-race/runner.sh', ...extraArguments]
            )
        ]
    }

    return [
        stage('API benchmark', '읽기·쓰기 단독/혼합 6개 부하 조합의 RPS와 latency 비교', 'bash', [
            'tests/api-benchmark/runner.sh',
            ...extraArguments
        ])
    ]
}

function formatDuration(milliseconds) {
    if (milliseconds < 1000) return `${milliseconds}ms`
    if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(1)}s`
    const minutes = Math.floor(milliseconds / 60_000)
    return `${minutes}m ${((milliseconds % 60_000) / 1000).toFixed(1)}s`
}

function markdownCell(value) {
    return String(value).replaceAll('|', '\\|').replaceAll('`', '\\`').replaceAll('\n', ' ')
}

function reportName(mode) {
    return mode === 'benchmark' ? 'benchmark-api.md' : `${mode}.md`
}

function displayCommand(mode, extraArguments) {
    const script = mode === 'benchmark' ? 'benchmark:api' : mode
    return formatCommand('pnpm', ['run', script, ...extraArguments])
}

function renderReport({ mode, command, startedAt, finishedAt, duration, results }) {
    const passed = results.every((result) => result.status === 'PASS')
    const rows = results.map(
        (result) =>
            `| ${result.status} | ${result.duration === undefined ? '—' : formatDuration(result.duration)} | ${markdownCell(result.area)} | ${markdownCell(result.reason)} | \`${markdownCell(result.command)}\` |`
    )
    const lines = [
        `# ${command} 실행 보고서`,
        '',
        `- 결과: **${passed ? 'PASS' : 'FAIL'}**`,
        `- 시작: ${startedAt.toISOString()}`,
        `- 종료: ${finishedAt.toISOString()}`,
        `- 전체 경과 시간: **${formatDuration(duration)}**`,
        '',
        '> 시간은 준비·build·정리를 포함한 실제 경과 시간이며 test runner 내부 시간과 다를 수 있다.',
        '',
        '| 결과 | 경과 시간 | 영역 | 확인한 내용 | 실행 명령 |',
        '| --- | ---: | --- | --- | --- |',
        ...rows
    ]

    if (
        (mode === 'atoz' || mode === 'e2e') &&
        existsSync(join(testsDirectory, 'web', '_output', 'report', 'index.html'))
    ) {
        lines.push(
            '',
            '- 브라우저 상세: [Playwright HTML](../../tests/web/_output/report/index.html)'
        )
    }
    if (mode === 'benchmark') {
        lines.push('', '- 집계 JSON·HTML dashboard: `tests/api-benchmark/_output/`')
    }
    if (notIncluded[mode]) {
        lines.push('', '## 이 명령에 포함되지 않음', '')
        lines.push(...notIncluded[mode].map((item) => `- ${item}`))
    }
    lines.push('')
    return lines.join('\n')
}

async function writeReport(report) {
    await mkdir(reportDirectory, { recursive: true })
    const path = join(reportDirectory, reportName(report.mode))
    const markdown = renderReport(report)
    await writeFile(path, markdown)
    if (process.env.GITHUB_STEP_SUMMARY) {
        try {
            await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${markdown}`)
        } catch (error) {
            console.warn(`GitHub Job Summary를 기록하지 못했습니다: ${error.message}`)
        }
    }
    return path
}

function printSummary(command, duration, results, reportPath) {
    const passed = results.every((result) => result.status === 'PASS')
    const rule = '='.repeat(96)
    console.log(`\n${rule}`)
    console.log(` ${command} 결과: ${passed ? 'PASS' : 'FAIL'} (${formatDuration(duration)})`)
    console.log(rule)
    for (const result of results) {
        const elapsed = result.duration === undefined ? '—' : formatDuration(result.duration)
        console.log(` ${result.status.padEnd(7)} ${elapsed.padStart(9)}  ${result.area}`)
        console.log(`                    ${result.reason}`)
    }
    console.log(rule)
    console.log(` 보고서: ${relative(workspaceRoot, reportPath)}`)
    console.log(`${rule}\n`)
}

async function main() {
    const mode = process.argv[2]
    const extraArguments = process.argv.slice(3)
    if (!['test', 'atoz', 'e2e', 'race', 'benchmark'].includes(mode)) {
        throw new Error(
            'usage: node tests/run-and-report.mjs <test|atoz|e2e|race|benchmark> [...args]'
        )
    }
    if (mode === 'race' && extraArguments.length === 0) {
        process.exitCode = await execute('bash', ['tests/api-race/runner.sh'])
        return
    }

    const command = displayCommand(mode, extraArguments)
    const stages = stagesFor(mode, extraArguments)
    const results = []
    const startedAt = new Date()
    const runStarted = performance.now()
    let exitCode = 0

    for (const [index, current] of stages.entries()) {
        console.log(`\n[${index + 1}/${stages.length}] ${current.area}`)
        console.log(`확인: ${current.reason}`)
        const stageStarted = performance.now()
        try {
            exitCode = await current.run()
        } catch (error) {
            exitCode = 1
            console.error(error)
        }
        results.push({
            area: current.area,
            reason: current.reason,
            command: current.command,
            status: exitCode === 0 ? 'PASS' : 'FAIL',
            duration: Math.round(performance.now() - stageStarted)
        })
        if (exitCode !== 0) break
    }
    for (const current of stages.slice(results.length)) {
        results.push({
            area: current.area,
            reason: current.reason,
            command: current.command,
            status: 'NOT RUN'
        })
    }

    const finishedAt = new Date()
    const duration = Math.round(performance.now() - runStarted)
    const reportPath = await writeReport({
        mode,
        command,
        startedAt,
        finishedAt,
        duration,
        results
    })
    printSummary(command, duration, results, reportPath)
    process.exitCode = exitCode
}

await main()
