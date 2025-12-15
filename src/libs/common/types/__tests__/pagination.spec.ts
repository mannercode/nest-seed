import { CommonErrors } from 'common'
import { withTestId } from 'testlib'
import { type PaginationFixture } from './pagination.fixture'

describe('CommonQuery', () => {
    let fix: PaginationFixture

    beforeEach(async () => {
        const { createPaginationFixture } = await import('./pagination.fixture')
        fix = await createPaginationFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('HTTP controller', () => {
        it('handles PaginationDto for a valid HTTP request', async () => {
            const skip = 2
            const take = 3
            await fix.httpClient
                .get('/pagination')
                .query({ skip, take, orderby: 'name:asc' })
                .ok({ response: { orderby: { direction: 'asc', name: 'name' }, skip, take } })
        })

        it('returns 400 Bad Request for a malformed `orderby`', async () => {
            await fix.httpClient
                .get('/pagination')
                .query({ orderby: 'wrong' })
                .badRequest(CommonErrors.Pagination.FormatInvalid)
        })

        it('returns 400 Bad Request for an invalid sort direction', async () => {
            await fix.httpClient
                .get('/pagination')
                .query({ orderby: 'name:wrong' })
                .badRequest(CommonErrors.Pagination.DirectionInvalid)
        })
    })

    describe('RPC controller', () => {
        it('handles PaginationDto for a valid RPC request', async () => {
            const skip = 2
            const take = 3
            const input = { orderby: { direction: 'asc', name: 'name' }, skip, take }

            await fix.rpcClient.expect(withTestId('getRpcPagination'), input, { response: input })
        })
    })
})
