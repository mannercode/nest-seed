import { CloseFixture, HttpTestClient } from 'testlib'

describe('Pagination', () => {
    let closeFixture: CloseFixture
    let client: HttpTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./pagination.pipe.fixture')

        const fixture = await createFixture()
        closeFixture = fixture.closeFixture
        client = fixture.client
    })

    afterEach(async () => {
        await closeFixture?.()
    })

    it('페이지네이션 옵션을 올바르게 적용해야 한다', async () => {
        const skip = 2
        const take = 3
        const res = await client.get('/samples').query({ skip, take, orderby: 'name:asc' }).ok()

        expect(res.body).toEqual({ orderby: { direction: 'asc', name: 'name' }, skip, take })
    })

    it('orderby 형식이 잘못되었을 때 BadRequest를 반환해야 한다', async () => {
        return client.get('/samples').query({ orderby: 'wrong' }).badRequest()
    })

    it('정렬 방향이 잘못되었을 때 BadRequest를 반환해야 한다', async () => {
        return client.get('/samples').query({ orderby: 'name:wrong' }).badRequest()
    })

    it("'take' 값이 지정된 제한을 초과하면 BadRequest를 반환해야 한다", async () => {
        const take = 51
        return client.get('/samples/takeLimit').query({ take }).badRequest()
    })

    it("'take' 값이 지정되지 않은 경우 기본값이 사용되어야 한다", async () => {
        const res = await client.get('/samples/takeLimit').query({}).ok()

        expect(res.body).toEqual({ skip: 0, take: 50 })
    })
})
