import { expect, test } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const invalidComponent = `
import { useEffect } from 'react'

export function InvalidComponent({ enabled }: { enabled: boolean }) {
    if (enabled) useEffect(() => undefined, [])
    return <img src="/poster.jpg" />
}
`

for (const appName of ['console', 'user-app'] as const) {
    test(`${appName} lint는 React hook, 접근성, Next 이미지 규칙을 적용한다`, async () => {
        const sourceDirectory = path.join(workspaceRoot, 'apps', appName, 'src')
        const temporaryDirectory = await mkdtemp(path.join(sourceDirectory, 'oxlint-contract-'))
        const filePath = path.join(temporaryDirectory, 'invalid-component.tsx')

        try {
            await writeFile(filePath, invalidComponent)
            const result = spawnSync(
                path.join(workspaceRoot, 'node_modules', '.bin', 'oxlint'),
                ['-c', path.join(workspaceRoot, 'oxlint.json'), filePath],
                { cwd: workspaceRoot, encoding: 'utf8' }
            )
            const output = `${result.stdout}\n${result.stderr}`

            expect(result.status, output).toBe(1)
            expect(output).toContain('rules-of-hooks')
            expect(output).toContain('alt-text')
            expect(output).toContain('no-img-element')
        } finally {
            await rm(temporaryDirectory, { force: true, recursive: true })
        }
    })
}
