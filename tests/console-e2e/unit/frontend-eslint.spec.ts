import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
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
        const appDirectory = path.join(workspaceRoot, 'apps', appName)
        const messages = await lintInvalidComponent(appDirectory)
        const ruleIds = messages.map(({ ruleId }) => ruleId)

        expect(ruleIds).toContain('react-hooks/rules-of-hooks')
        expect(ruleIds).toContain('jsx-a11y/alt-text')
        expect(ruleIds).toContain('@next/next/no-img-element')
    })
}

async function lintInvalidComponent(appDirectory: string) {
    const eslintBinary = path.join(workspaceRoot, 'node_modules', '.bin', 'eslint')
    const filePath = path.join(appDirectory, 'src', 'invalid-component.tsx')

    return new Promise<Array<{ ruleId: string | null }>>((resolve, reject) => {
        const child = spawn(
            eslintBinary,
            ['--format', 'json', '--stdin', '--stdin-filename', filePath],
            { cwd: appDirectory }
        )
        let stdout = ''
        let stderr = ''
        child.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk))
        child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk))
        child.on('error', reject)
        child.on('close', (code) => {
            if (code !== 0 && code !== 1) {
                reject(new Error(`ESLint exited ${code}: ${stderr}`))
                return
            }
            try {
                const results = JSON.parse(stdout) as Array<{
                    messages: Array<{ ruleId: string | null }>
                }>
                resolve(results[0]?.messages ?? [])
            } catch (error) {
                reject(new Error(`Invalid ESLint JSON: ${stdout}\n${stderr}`, { cause: error }))
            }
        })
        child.stdin.end(invalidComponent)
    })
}
