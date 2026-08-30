import { lstat, readFile, readdir, realpath, rm } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootGeneratedPaths = ['.husky/_', 'coverage', 'node_modules', 'scheduled_tasks.lock']
const workspaceGeneratedPaths = [
    '.next',
    '_output',
    'coverage',
    'next-env.d.ts',
    'node_modules',
    'playwright-report',
    'test-results',
    'tsconfig.tsbuildinfo'
]

const pathExists = async (path) => {
    try {
        await lstat(path)
        return true
    } catch (error) {
        if (error?.code === 'ENOENT') return false
        throw error
    }
}

const rootOutputGeneratedPaths = async (root) => {
    const outputPath = join(root, '_output')
    if (!(await pathExists(outputPath))) return []

    const outputStat = await lstat(outputPath)
    if (!outputStat.isDirectory() || outputStat.isSymbolicLink()) return ['_output']

    return (await readdir(outputPath))
        .filter((name) => name !== 'test-reports')
        .map((name) => join('_output', name))
}

const workspaceDirectories = async (root, patterns) => {
    const directories = []
    for (const pattern of patterns) {
        if (!pattern.endsWith('/*')) {
            directories.push(pattern)
            continue
        }

        const parent = pattern.slice(0, -2)
        const entries = await readdir(join(root, parent), { withFileTypes: true })
        for (const entry of entries) {
            if (entry.isDirectory() || entry.isSymbolicLink()) {
                directories.push(join(parent, entry.name))
            }
        }
    }
    return directories
}

export function parseWorkspacePatterns(source) {
    const lines = source.split(/\r?\n/)
    const packagesLine = lines.findIndex((line) => line === 'packages:')
    if (packagesLine < 0) throw new Error('pnpm-workspace.yaml must contain a packages list')

    const patterns = []
    for (const line of lines.slice(packagesLine + 1)) {
        if (/^\S/.test(line) && !line.startsWith('#')) break
        if (line.trim() === '' || line.trimStart().startsWith('#')) continue

        const entry = line.match(/^\s+-\s+(['"])(.+)\1\s*$/)
        if (!entry) throw new Error(`Unsupported pnpm workspace entry: ${line.trim()}`)
        patterns.push(entry[2])
    }
    if (patterns.length === 0) throw new Error('pnpm-workspace.yaml packages list is empty')
    return patterns
}

export async function cleanWorkspace(workspaceRoot) {
    const root = resolve(workspaceRoot)
    const resolvedRoot = await realpath(root)
    const workspaceConfig = await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8')
    const workspacePaths = await workspaceDirectories(root, parseWorkspacePatterns(workspaceConfig))
    const candidates = new Set([...rootGeneratedPaths, ...(await rootOutputGeneratedPaths(root))])

    for (const workspace of workspacePaths) {
        const workspacePath = resolve(root, workspace)
        if ((await pathExists(workspacePath)) && (await lstat(workspacePath)).isSymbolicLink()) {
            throw new Error(`Refusing to clean symlinked workspace: ${workspace}`)
        }
        for (const generated of workspaceGeneratedPaths) candidates.add(join(workspace, generated))
    }
    candidates.add('apps/api/api-docs/_output')

    const removed = []
    for (const candidate of [...candidates].sort((left, right) => right.length - left.length)) {
        const absolute = resolve(root, candidate)
        const withinRoot = absolute.startsWith(`${root}${sep}`)
        if (!withinRoot) throw new Error(`Refusing to clean outside workspace: ${candidate}`)
        if (!(await pathExists(absolute))) continue

        const resolvedParent = await realpath(dirname(absolute))
        const parentWithinRoot =
            resolvedParent === resolvedRoot || resolvedParent.startsWith(`${resolvedRoot}${sep}`)
        if (!parentWithinRoot) {
            throw new Error(`Refusing to clean through a symlink outside workspace: ${candidate}`)
        }

        await rm(absolute, { force: true, recursive: true })
        removed.push(relative(root, absolute))
    }
    return removed.sort()
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (isMain) {
    const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
    const removed = await cleanWorkspace(defaultRoot)
    if (removed.length > 0)
        process.stdout.write(`Removed generated paths:\n${removed.join('\n')}\n`)
}
