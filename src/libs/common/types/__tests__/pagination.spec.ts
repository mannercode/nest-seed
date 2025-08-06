import { CommonErrors } from 'common'
import { withTestId } from 'testlib'
import { type Fixture } from './pagination.fixture'

describe('CommonQuery', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./pagination.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    // HttpController에서 PaginationDto을 처리해야 한다
    it('Should handle PaginationDto in HttpController', async () => {
        const skip = 2
        const take = 3
        await fix.httpClient
            .get('/pagination')
            .query({ skip, take, orderby: 'name:asc' })
            .ok({ response: { orderby: { direction: 'asc', name: 'name' }, skip, take } })
    })

    // RpcController에서 PaginationDto을 처리해야 한다
    it('Should handle PaginationDto in RpcController', async () => {
        const skip = 2
        const take = 3
        const input = { orderby: { direction: 'asc', name: 'name' }, skip, take }

        await fix.rpcClient.expect(withTestId('getRpcPagination'), input, { response: input })
    })

    // orderby 형식이 잘못되었을 때 BadRequest를 반환해야 한다
    it('Should return BadRequest when the orderby format is invalid', async () => {
        await fix.httpClient
            .get('/pagination')
            .query({ orderby: 'wrong' })
            .badRequest(CommonErrors.Pagination.FormatInvalid)
    })

    // 정렬 방향이 잘못되었을 때 BadRequest를 반환해야 한다
    it('Should return BadRequest when the sort direction is invalid', async () => {
        await fix.httpClient
            .get('/pagination')
            .query({ orderby: 'name:wrong' })
            .badRequest(CommonErrors.Pagination.DirectionInvalid)
    })
})
