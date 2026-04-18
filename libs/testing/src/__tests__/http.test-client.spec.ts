import type { HttpTestClientFixture } from './http.test-client.fixture'

jest.mock('fs', () => {
    const actual = jest.requireActual('fs')
    return {
        ...actual,
        createWriteStream: jest.fn(() => ({
            write: () => true,
            close: (cb: (err?: Error | null) => void) => cb(new Error('disk write failed')),
            destroy: () => {}
        }))
    }
})

describe('HttpTestClient', () => {
    let fix: HttpTestClientFixture

    beforeEach(async () => {
        const { createHttpTestClientFixture } = await import('./http.test-client.fixture')
        fix = await createHttpTestClientFixture()
    })
    afterEach(() => fix.teardown())

    describe('download', () => {
        // writeStream 닫기가 실패하면 다운로드 작업이 에러를 전파한다
        it('propagates writeStream close errors', async () => {
            await expect(
                fix.httpClient.get('/download').download('/tmp/ignored').send(200)
            ).rejects.toThrow(/disk write failed/)
        })
    })
})
