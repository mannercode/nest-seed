import assert from 'node:assert/strict'
import { chmod, copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

test('lint-staged preserves spaces and apostrophes while partitioning JavaScript files', async (t) => {
    const repository = await mkdtemp(join(tmpdir(), 'nest-seed-lint-staged-'))
    const mockBin = join(repository, 'node_modules/.bin')
    const argumentLog = join(repository, 'npm-arguments.jsonl')
    const wrapperPath = join(repository, 'tools/lint-staged-js.mjs')
    t.after(async () => {
        const { rm } = await import('node:fs/promises')
        await rm(repository, { force: true, recursive: true })
    })

    await Promise.all([
        mkdir(join(repository, 'apps/api/scripts'), { recursive: true }),
        mkdir(join(repository, 'tests/api-race'), { recursive: true }),
        mkdir(join(repository, 'tools'), { recursive: true }),
        mkdir(mockBin, { recursive: true })
    ])
    await Promise.all([
        copyFile(join(root, 'tools/lint-staged-js.mjs'), wrapperPath),
        writeFile(
            join(repository, 'lint-staged.config.cjs'),
            "module.exports = { '*.{cjs,js,mjs}': 'node tools/lint-staged-js.mjs' }\n"
        ),
        writeFile(join(repository, "apps/api/scripts/it's spaced.js"), 'module.exports = {}\n'),
        writeFile(join(repository, "tests/api-race/race's case.js"), 'module.exports = {}\n'),
        writeFile(join(repository, "root file's.js"), 'module.exports = {}\n'),
        writeFile(
            join(mockBin, 'npm'),
            '#!/usr/bin/env node\n' +
                "require('node:fs').appendFileSync(process.env.ARGUMENT_LOG, JSON.stringify(process.argv.slice(2)) + '\\n')\n"
        )
    ])
    await chmod(join(mockBin, 'npm'), 0o755)

    for (const args of [
        ['init', '--quiet'],
        [
            'add',
            '--',
            "apps/api/scripts/it's spaced.js",
            "tests/api-race/race's case.js",
            "root file's.js"
        ]
    ]) {
        const result = spawnSync('git', args, { cwd: repository, encoding: 'utf8' })
        assert.equal(result.status, 0, result.stderr || 'git command failed')
    }

    const lintStaged = spawnSync(
        process.execPath,
        [
            join(root, 'node_modules/lint-staged/bin/lint-staged.js'),
            '--config',
            'lint-staged.config.cjs',
            '--cwd',
            repository,
            '--no-stash'
        ],
        {
            cwd: repository,
            encoding: 'utf8',
            env: {
                ...process.env,
                ARGUMENT_LOG: argumentLog,
                PATH: `${mockBin}:${process.env.PATH}`
            }
        }
    )
    assert.equal(lintStaged.status, 0, `${lintStaged.stdout}\n${lintStaged.stderr}`)

    const calls = (await readFile(argumentLog, 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    assert.equal(calls.length, 3)

    assert.deepEqual(calls[0].slice(0, 6), [
        'exec',
        '--workspace',
        'tests/api-race',
        '--',
        'eslint',
        '--fix'
    ])
    assert.deepEqual(calls[0].slice(6), [join(repository, "tests/api-race/race's case.js")])
    assert.deepEqual(calls[1].slice(0, 6), [
        'exec',
        '--workspace',
        'apps/api',
        '--',
        'eslint',
        '--fix'
    ])
    assert.deepEqual(calls[1].slice(6), [join(repository, "apps/api/scripts/it's spaced.js")])
    assert.deepEqual(calls[2].slice(0, 4), ['exec', '--', 'prettier', '--write'])
    assert.deepEqual(
        new Set(calls[2].slice(4)),
        new Set([
            join(repository, "apps/api/scripts/it's spaced.js"),
            join(repository, "root file's.js"),
            join(repository, "tests/api-race/race's case.js")
        ])
    )
})
