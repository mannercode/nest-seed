import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { findPackageJSON } from 'node:module'
import { dirname } from 'node:path'
import { type AppTestContext, createAppTestContext } from './helpers/index.js'

describe('API 사용 예제', () => {
    let fix: AppTestContext

    beforeEach(async () => {
        fix = await createAppTestContext({ enableRestate: true })
    })
    afterEach(() => fix?.teardown())

    it('curl 예제를 실행하면 API가 문서에 적힌 상태 코드를 반환한다', async ({ signal }) => {
        const runner = spawn('bash', ['api-docs/run.sh'], {
            cwd: dirname(findPackageJSON(import.meta.url)!),
            env: { ...process.env, SERVER_URL: fix.httpClient.serverUrl },
            signal,
            stdio: 'inherit'
        })
        const [exitCode] = await once(runner, 'close')

        expect(exitCode).toBe(0)
    })
})
