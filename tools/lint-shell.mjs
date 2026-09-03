import { spawnSync } from 'node:child_process'
import { lstatSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcedFixture = resolve(workspaceRoot, 'apps/api/api-docs/common.fixture')
const shellShebang = /^#!.*(?:\/| )(?:ba)?sh(?:\s|$)/

const workspaceFiles = () => {
    // 아직 커밋하지 않은 새 스크립트도 검사하되, 생성물·vendor 경로는 저장소 ignore 규칙으로 제외한다.
    const result = spawnSync(
        'git',
        ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
        { cwd: workspaceRoot, encoding: 'utf8', shell: false }
    )
    if (result.error) throw result.error
    if (result.status !== 0) {
        process.stderr.write(result.stderr)
        process.exit(result.status ?? 1)
    }
    return result.stdout
        .split('\0')
        .filter(Boolean)
        .map((file) => resolve(workspaceRoot, file))
}

const insideWorkspace = (file) => {
    const pathFromRoot = relative(workspaceRoot, file)
    return pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`)
}

const isTemporaryFile = (file) => {
    const pathFromRoot = relative(workspaceRoot, file)
    return pathFromRoot === '_todo' || pathFromRoot.startsWith(`_todo${sep}`)
}

const isShellFile = (file) => {
    try {
        if (!lstatSync(file).isFile()) return false
        return shellShebang.test(readFileSync(file, 'utf8').split(/\r?\n/, 1)[0])
    } catch (error) {
        if (error?.code === 'ENOENT') return false
        throw error
    }
}

const allWorkspaceFiles = workspaceFiles()
const requestedFiles = process.argv.slice(2).map((file) => resolve(workspaceRoot, file))
if (requestedFiles.some((file) => !insideWorkspace(file))) {
    throw new Error('Refusing to lint a shell file outside the workspace')
}

const selected = new Set(
    (requestedFiles.length > 0 ? requestedFiles : allWorkspaceFiles).filter(
        (file) => !isTemporaryFile(file) && isShellFile(file)
    )
)
// common.fixture는 직접 실행하지 않고 source한다. 모든 spec을 -x로 검사하면 실제 문맥에서 fixture를
// 해석하므로, fixture만 따로 검사할 때 생기는 잘못된 미사용 변수 경고를 피할 수 있다.
if (selected.delete(sourcedFixture)) {
    for (const file of allWorkspaceFiles) {
        const pathFromRoot = relative(workspaceRoot, file).replaceAll(sep, '/')
        if (/^apps\/api\/api-docs\/[^/]+\.spec$/.test(pathFromRoot) && isShellFile(file)) {
            selected.add(file)
        }
    }
}

const files = [...selected].sort()
if (files.length > 0) {
    const result = spawnSync('shellcheck', ['--severity=warning', '-x', '--', ...files], {
        cwd: workspaceRoot,
        shell: false,
        stdio: 'inherit'
    })
    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status ?? 1)
}
