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
        describe('when the request is valid', () => {
            it('handles PaginationDto', async () => {
                const skip = 2
                const take = 3
                await fix.httpClient
                    .get('/pagination')
                    .query({ skip, take, orderby: 'name:asc' })
                    .ok({ response: { orderby: { direction: 'asc', name: 'name' }, skip, take } })
            })
        })

        describe('when the `orderby` is malformed', () => {
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .get('/pagination')
                    .query({ orderby: 'wrong' })
                    .badRequest(CommonErrors.Pagination.FormatInvalid)
            })
        })

        describe('when the sort direction is invalid', () => {
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .get('/pagination')
                    .query({ orderby: 'name:wrong' })
                    .badRequest(CommonErrors.Pagination.DirectionInvalid)
            })
        })
    })

    describe('RPC controller', () => {
        describe('when the request is valid', () => {
            it('handles PaginationDto', async () => {
                const skip = 2
                const take = 3
                const input = { orderby: { direction: 'asc', name: 'name' }, skip, take }

                await fix.rpcClient.expect(withTestId('getRpcPagination'), input, {
                    response: input
                })
            })
        })
    })
})
