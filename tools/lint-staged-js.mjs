import { spawnSync } from 'node:child_process'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const files = process.argv.slice(2).map((file) => resolve(workspaceRoot, file))
const pnpmExecutable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

const filesIn = (workspace) =>
    files.filter((file) => {
        const pathFromWorkspace = relative(resolve(workspaceRoot, workspace), file)
        return pathFromWorkspace !== '..' && !pathFromWorkspace.startsWith(`..${sep}`)
    })

const runPnpm = (args) => {
    const result = spawnSync(pnpmExecutable, args, {
        cwd: workspaceRoot,
        shell: false,
        stdio: 'inherit'
    })
    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status ?? 1)
}

const raceFiles = filesIn('tests/api-race')
if (raceFiles.length > 0) {
    runPnpm([
        '--filter',
        './tests/api-race',
        '--fail-if-no-match',
        'exec',
        'eslint',
        '--fix',
        ...raceFiles
    ])
}

const apiFiles = filesIn('apps/api')
if (apiFiles.length > 0) {
    runPnpm([
        '--filter',
        './apps/api',
        '--fail-if-no-match',
        'exec',
        'eslint',
        '--fix',
        ...apiFiles
    ])
}

if (files.length > 0) runPnpm(['exec', 'prettier', '--write', ...files])
