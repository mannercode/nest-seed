import assert from 'node:assert/strict'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

test('shell lint discovers extensionless hooks and checks sourced fixtures through every spec', async (t) => {
    const repository = await mkdtemp(join(tmpdir(), 'nest-seed-lint-shell-'))
    const mockBin = join(repository, 'mock-bin')
    const argumentLog = join(repository, 'shellcheck-arguments.jsonl')
    const lintShell = join(repository, 'tools/lint-shell.mjs')
    t.after(async () => {
        await rm(repository, { force: true, recursive: true })
    })

    await Promise.all([
        mkdir(join(repository, '.husky'), { recursive: true }),
        mkdir(join(repository, '_todo'), { recursive: true }),
        mkdir(join(repository, 'apps/api/api-docs'), { recursive: true }),
        mkdir(join(repository, 'tools'), { recursive: true }),
        mkdir(mockBin)
    ])
    await Promise.all([
        copyFile(join(root, 'tools/lint-shell.mjs'), lintShell),
        writeFile(join(repository, '.husky/pre-commit'), '#!/bin/sh\nexit 0\n'),
        writeFile(join(repository, '_todo/ignored.sh'), '#!/bin/bash\nexit 1\n'),
        writeFile(
            join(repository, 'apps/api/api-docs/common.fixture'),
            '#!/bin/bash\nSHARED_VALUE=value\n'
        ),
        writeFile(
            join(repository, 'apps/api/api-docs/health.spec'),
            '#!/bin/bash\n. ./common.fixture\nprintf "%s\\n" "$SHARED_VALUE"\n'
        ),
        writeFile(join(repository, 'not-shell.js'), '#!/usr/bin/env node\n'),
        writeFile(
            join(mockBin, 'shellcheck'),
            '#!/usr/bin/env node\n' +
                "require('node:fs').appendFileSync(process.env.ARGUMENT_LOG, JSON.stringify(process.argv.slice(2)) + '\\n')\n"
        )
    ])
    await chmod(join(mockBin, 'shellcheck'), 0o755)

    for (const args of [
        ['init', '--quiet'],
        ['add', '.']
    ]) {
        const result = spawnSync('git', args, { cwd: repository, encoding: 'utf8' })
        assert.equal(result.status, 0, result.stderr || 'git command failed')
    }
    await writeFile(join(repository, 'untracked-check.sh'), '#!/bin/bash\nexit 0\n')

    const environment = {
        ...process.env,
        ARGUMENT_LOG: argumentLog,
        PATH: `${mockBin}:${process.env.PATH}`
    }
    const fullRun = spawnSync(process.execPath, [lintShell], {
        cwd: repository,
        encoding: 'utf8',
        env: environment
    })
    assert.equal(fullRun.status, 0, fullRun.stderr || 'full shell lint failed')

    const fixtureRun = spawnSync(
        process.execPath,
        [lintShell, join(repository, 'apps/api/api-docs/common.fixture')],
        { cwd: repository, encoding: 'utf8', env: environment }
    )
    assert.equal(fixtureRun.status, 0, fixtureRun.stderr || 'fixture shell lint failed')

    const calls = (await readFile(argumentLog, 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    assert.equal(calls.length, 2)
    assert.deepEqual(calls[0].slice(0, 3), ['--severity=warning', '-x', '--'])
    assert.ok(calls[0].includes(join(repository, '.husky/pre-commit')))
    assert.ok(calls[0].includes(join(repository, 'apps/api/api-docs/health.spec')))
    assert.ok(calls[0].includes(join(repository, 'untracked-check.sh')))
    assert.ok(!calls[0].includes(join(repository, '_todo/ignored.sh')))
    assert.ok(!calls[0].includes(join(repository, 'apps/api/api-docs/common.fixture')))
    assert.ok(!calls[0].includes(join(repository, 'not-shell.js')))
    assert.deepEqual(calls[1].slice(3), [join(repository, 'apps/api/api-docs/health.spec')])
})
