import { CommonErrors } from 'common'
import { withTestId } from 'testlib'
import { type Fixture } from './pagination.fixture'

describe('CommonQuery', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./pagination.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('HTTP controller', () => {
        describe('when the request is valid', () => {
            it('handles PaginationDto', async () => {
                const skip = 2
                const take = 3
                await fixture.httpClient
                    .get('/pagination')
                    .query({ skip, take, orderby: 'name:asc' })
                    .ok({ response: { orderby: { direction: 'asc', name: 'name' }, skip, take } })
            })
        })

        describe('when the `orderby` is malformed', () => {
            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .get('/pagination')
                    .query({ orderby: 'wrong' })
                    .badRequest(CommonErrors.Pagination.FormatInvalid)
            })
        })

        describe('when the sort direction is invalid', () => {
            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
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

                await fixture.rpcClient.expect(withTestId('getRpcPagination'), input, {
                    response: input
                })
            })
        })
    })
})
