const path = require('node:path')
const { spawn } = require('node:child_process')

class VitestFailureDiagnosticsReporter {
    diagnostics

    enabled() {
        return process.env.CI === 'true' || process.env.MONGO_DIAGNOSTICS_ON_TEST_FAILURE === 'true'
    }

    startDiagnostics() {
        if (this.diagnostics) return this.diagnostics

        const workspaceRoot =
            process.env.WORKSPACE_ROOT ?? path.resolve(__dirname, '..', '..', '..')
        const diagnosticsScript = path.join(
            workspaceRoot,
            '.github',
            'scripts',
            'dump-mongo-diagnostics.sh'
        )
        this.diagnostics = new Promise((resolve) => {
            const child = spawn('timeout', ['--kill-after=5s', '110s', 'bash', diagnosticsScript], {
                cwd: workspaceRoot,
                env: process.env,
                stdio: 'inherit'
            })
            child.once('error', () => {
                process.stderr.write('[mongo-diagnostics] failed to start Vitest diagnostics\n')
                resolve()
            })
            child.once('close', (code) => {
                if (code !== 0) {
                    process.stderr.write(
                        `[mongo-diagnostics] Vitest diagnostics exited with code ${code ?? 'signal'}\n`
                    )
                }
                resolve()
            })
        })
        return this.diagnostics
    }

    onTestCaseResult(testCase) {
        if (this.enabled() && testCase.result().state === 'failed') this.startDiagnostics()
    }

    onTestModuleEnd(testModule) {
        if (this.enabled() && testModule.state() === 'failed') this.startDiagnostics()
    }

    onTestRunEnd() {
        return this.diagnostics
    }
}

module.exports = VitestFailureDiagnosticsReporter
