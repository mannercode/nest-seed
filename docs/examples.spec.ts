// 테스트 대상 서비스
describe('SampleService', () => {
    // 테스트 환경 생성과 해제.
    let fix: SamplesFixture

    beforeEach(async () => {
        // resetModules이 true면 동적 import 해야 한다.
        const { createSamplesFixture } = await import('./samples.fixture')
        fix = await createSamplesFixture()
    })
    afterEach(() => fix.teardown())

    // 서비스를 호출하는 최상위 인터페이스
    describe('POST /samples', () => {
        // 기본적으로 fixture는 정상이라고 가정한다.
        it('returns the created movie-draft', async () => {
            await fix.httpClient
                .post('/movie-drafts')
                .created(expect.objectContaining({ id: expect.any(String) }))
        })
    })
})
