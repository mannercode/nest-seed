import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

test('CI diagnostic wrapper persists output and preserves the original exit code', async (t) => {
    const workspace = await mkdtemp(join(tmpdir(), 'nest-seed-ci-diagnostics-'))
    const mockBin = join(workspace, 'bin')
    const { mkdir, rm } = await import('node:fs/promises')
    await mkdir(mockBin)
    t.after(() => rm(workspace, { force: true, recursive: true }))

    const timeout = join(mockBin, 'timeout')
    await writeFile(
        timeout,
        '#!/bin/sh\necho "mongo diagnostic stdout"\necho "mongo diagnostic stderr" >&2\nexit 0\n'
    )
    await chmod(timeout, 0o755)

    const result = spawnSync(
        'bash',
        [join(root, '.github/scripts/run-with-ci-diagnostics.sh'), 'bash', '-c', 'exit 23'],
        {
            encoding: 'utf8',
            env: {
                ...process.env,
                PATH: `${mockBin}:${process.env.PATH}`,
                WORKSPACE_ROOT: workspace
            }
        }
    )

    assert.equal(result.status, 23)
    const diagnostics = await readFile(join(workspace, '_output/ci-diagnostics/mongo.txt'), 'utf8')
    assert.match(diagnostics, /mongo diagnostic stdout/)
    assert.match(diagnostics, /mongo diagnostic stderr/)
    const failure = await readFile(join(workspace, '_output/ci-diagnostics/failure.txt'), 'utf8')
    assert.match(failure, /^exit_code=23$/m)
    assert.match(failure, /^command= bash -c exit\\ 23$/m)
})
