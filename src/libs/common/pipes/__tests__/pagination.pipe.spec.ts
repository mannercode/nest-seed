import { HttpTestClient, TestContext } from 'testlib'

describe('Pagination', () => {
    let testContext: TestContext
    let client: HttpTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./pagination.pipe.fixture')
        const fixture = await createFixture()

        testContext = fixture.testContext
        client = fixture.client
    })

    afterEach(async () => {
        await testContext?.close()
    })

    it('should apply pagination options correctly', async () => {
        const skip = 2
        const take = 3
        const res = await client.get('/samples').query({ skip, take, orderby: 'name:asc' }).ok()

        expect(res.body).toEqual({ orderby: { direction: 'asc', name: 'name' }, skip, take })
    })

    it('should return Bad Request when orderby format is incorrect', async () => {
        return client.get('/samples').query({ orderby: 'wrong' }).badRequest()
    })

    it('should return Bad Request when order direction is incorrect', async () => {
        return client.get('/samples').query({ orderby: 'name:wrong' }).badRequest()
    })

    it("Should return Bad Request when 'take' exceeds the specified limit", async () => {
        const take = 51
        return client.get('/samples/takeLimit').query({ take }).badRequest()
    })

    it('If ‘take’ is not specified, a default value is used.', async () => {
        const res = await client.get('/samples/takeLimit').query({}).ok()

        expect(res.body).toEqual({ skip: 0, take: 50 })
    })
})
