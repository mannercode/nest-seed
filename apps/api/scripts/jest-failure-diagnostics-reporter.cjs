const path = require('path')
const { spawn } = require('child_process')

class JestFailureDiagnosticsReporter {
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
                process.stderr.write('[mongo-diagnostics] failed to start Jest diagnostics\n')
                resolve()
            })
            child.once('close', (code) => {
                if (code !== 0) {
                    process.stderr.write(
                        `[mongo-diagnostics] Jest diagnostics exited with code ${code ?? 'signal'}\n`
                    )
                }
                resolve()
            })
        })
        return this.diagnostics
    }

    onTestCaseResult(_test, testCaseResult) {
        if (this.enabled() && testCaseResult.status === 'failed') this.startDiagnostics()
    }

    onTestFileResult(_test, testResult) {
        const failed = testResult.numFailingTests > 0 || testResult.testExecError != null
        if (!this.enabled() || !failed) return undefined
        return this.startDiagnostics()
    }

    onRunComplete() {
        return this.diagnostics
    }
}

module.exports = JestFailureDiagnosticsReporter
