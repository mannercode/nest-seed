import { plainToInstance } from 'class-transformer'
import { CloseFixture, HttpTestClient } from 'testlib'
import { PaginationOptionDto } from '../pagination.pipe'

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
        await client
            .get('/samples')
            .query({ skip, take, orderby: 'name:asc' })
            .ok({ orderby: { direction: 'asc', name: 'name' }, skip, take })
    })

    it('입력이 이미 객체일 경우 그대로 반환해야 한다', () => {
        const input = { name: 'createdAt', direction: 'asc' }

        const instance = plainToInstance(PaginationOptionDto, { orderby: input })

        expect(instance.orderby).toEqual(input)
    })

    it('orderby 형식이 잘못되었을 때 BadRequest를 반환해야 한다', async () => {
        await client.get('/samples').query({ orderby: 'wrong' }).badRequest({
            code: 'ERR_ORDERBY_FORMAT_INVALID',
            message: 'Invalid orderby format. It should be "name:direction".'
        })
    })

    it('정렬 방향이 잘못되었을 때 BadRequest를 반환해야 한다', async () => {
        await client.get('/samples').query({ orderby: 'name:wrong' }).badRequest({
            code: 'ERR_ORDERBY_DIRECTION_INVALID',
            message: 'Invalid direction. It should be either "asc" or "desc".'
        })
    })

    it("'take' 값이 지정된 제한을 초과하면 BadRequest를 반환해야 한다", async () => {
        const take = 51
        await client.get('/samples/takeLimit').query({ take }).badRequest({
            code: 'ERR_PAGINATION_TAKE_LIMIT_EXCEEDED',
            message: "The 'take' parameter exceeds the maximum allowed limit.",
            take,
            takeLimit: 50
        })
    })

    it("'take' 값이 지정되지 않은 경우 기본값이 사용되어야 한다", async () => {
        await client.get('/samples/takeLimit').query({}).ok({ skip: 0, take: 50 })
    })
})
