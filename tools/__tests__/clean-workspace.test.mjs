import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { cleanWorkspace } from '../clean-workspace.mjs'

test('cleanWorkspace removes only generated paths and preserves personal files', async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'nest-seed-clean-'))
    const outside = await mkdtemp(join(tmpdir(), 'nest-seed-clean-outside-'))
    t.after(async () => {
        const { rm } = await import('node:fs/promises')
        await Promise.all([
            rm(root, { force: true, recursive: true }),
            rm(outside, { force: true, recursive: true })
        ])
    })

    await Promise.all([
        mkdir(join(root, 'apps/api/_output'), { recursive: true }),
        mkdir(join(root, 'apps/console/.next'), { recursive: true }),
        mkdir(join(root, 'tests/web/test-results'), { recursive: true }),
        mkdir(join(root, 'node_modules'), { recursive: true }),
        mkdir(join(root, 'notes'), { recursive: true })
    ])
    await Promise.all([
        writeFile(
            join(root, 'pnpm-workspace.yaml'),
            "packages:\n    - 'apps/*'\n    - 'tests/*'\n"
        ),
        writeFile(join(root, '.env.local'), 'PRIVATE=value\n'),
        writeFile(join(root, 'notes/keep.txt'), 'keep\n'),
        writeFile(join(root, 'apps/api/_output/generated.txt'), 'generated\n'),
        writeFile(join(root, 'apps/console/next-env.d.ts'), 'generated\n'),
        writeFile(join(root, 'outside-marker'), 'replace-with-symlink\n'),
        writeFile(join(outside, 'marker.txt'), 'outside\n')
    ])

    const { rm } = await import('node:fs/promises')
    await rm(join(root, 'outside-marker'))
    await symlink(outside, join(root, '_output'))

    const removed = await cleanWorkspace(root)

    assert.ok(removed.includes('apps/api/_output'))
    assert.ok(removed.includes('apps/console/.next'))
    assert.ok(removed.includes('apps/console/next-env.d.ts'))
    assert.ok(removed.includes('node_modules'))
    await assert.rejects(readFile(join(root, 'apps/api/_output/generated.txt')))
    assert.equal(await readFile(join(root, '.env.local'), 'utf8'), 'PRIVATE=value\n')
    assert.equal(await readFile(join(root, 'notes/keep.txt'), 'utf8'), 'keep\n')
    assert.equal(await readFile(join(outside, 'marker.txt'), 'utf8'), 'outside\n')
})

test('cleanWorkspace refuses generated paths beneath a symlinked workspace', async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'nest-seed-clean-link-'))
    const outside = await mkdtemp(join(tmpdir(), 'nest-seed-clean-link-outside-'))
    t.after(async () => {
        const { rm } = await import('node:fs/promises')
        await Promise.all([
            rm(root, { force: true, recursive: true }),
            rm(outside, { force: true, recursive: true })
        ])
    })

    await Promise.all([
        mkdir(join(root, 'libs'), { recursive: true }),
        mkdir(join(outside, 'node_modules'), { recursive: true })
    ])
    await Promise.all([
        writeFile(join(root, 'pnpm-workspace.yaml'), "packages:\n    - 'libs/common'\n"),
        writeFile(join(outside, 'node_modules/marker.txt'), 'outside dependency\n')
    ])
    await symlink(outside, join(root, 'libs/common'))

    await assert.rejects(cleanWorkspace(root), /symlinked workspace/)
    assert.equal(
        await readFile(join(outside, 'node_modules/marker.txt'), 'utf8'),
        'outside dependency\n'
    )
})

test('cleanWorkspace preserves test reports and removes other root output', async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'nest-seed-clean-reports-'))
    t.after(async () => {
        const { rm } = await import('node:fs/promises')
        await rm(root, { force: true, recursive: true })
    })

    await Promise.all([
        mkdir(join(root, '_output/test-reports'), { recursive: true }),
        mkdir(join(root, '_output/ci-diagnostics'), { recursive: true }),
        mkdir(join(root, '_output/other'), { recursive: true })
    ])
    await Promise.all([
        writeFile(join(root, 'pnpm-workspace.yaml'), "packages:\n    - 'libs/common'\n"),
        writeFile(join(root, '_output/test-reports/test.md'), 'latest report\n'),
        writeFile(join(root, '_output/ci-diagnostics/failure.txt'), 'generated\n'),
        writeFile(join(root, '_output/other/generated.txt'), 'generated\n')
    ])

    const removed = await cleanWorkspace(root)

    assert.equal(
        await readFile(join(root, '_output/test-reports/test.md'), 'utf8'),
        'latest report\n'
    )
    await assert.rejects(readFile(join(root, '_output/ci-diagnostics/failure.txt')))
    await assert.rejects(readFile(join(root, '_output/other/generated.txt')))
    assert.ok(removed.includes('_output/ci-diagnostics'))
    assert.ok(removed.includes('_output/other'))
})
