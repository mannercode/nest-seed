import { spawnSync } from 'node:child_process'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const files = process.argv.slice(2).map((file) => resolve(workspaceRoot, file))
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const filesIn = (workspace) =>
    files.filter((file) => {
        const pathFromWorkspace = relative(resolve(workspaceRoot, workspace), file)
        return pathFromWorkspace !== '..' && !pathFromWorkspace.startsWith(`..${sep}`)
    })

const runNpm = (args) => {
    const result = spawnSync(npmExecutable, args, {
        cwd: workspaceRoot,
        shell: false,
        stdio: 'inherit'
    })
    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status ?? 1)
}

const raceFiles = filesIn('tests/api-race')
if (raceFiles.length > 0) {
    runNpm(['exec', '--workspace', 'tests/api-race', '--', 'eslint', '--fix', ...raceFiles])
}

const apiFiles = filesIn('apps/api')
if (apiFiles.length > 0) {
    runNpm(['exec', '--workspace', 'apps/api', '--', 'eslint', '--fix', ...apiFiles])
}

if (files.length > 0) runNpm(['exec', '--', 'prettier', '--write', ...files])
