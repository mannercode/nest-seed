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

    describe('HTTP controller', () => {
        // 요청이 유효한 경우
        describe('when the request is valid', () => {
            // PaginationDto를 처리한다
            it('handles PaginationDto', async () => {
                const skip = 2
                const take = 3
                await fix.httpClient
                    .get('/pagination')
                    .query({ skip, take, orderby: 'name:asc' })
                    .ok({ response: { orderby: { direction: 'asc', name: 'name' }, skip, take } })
            })
        })

        // orderby 형식이 잘못된 경우
        describe('when `orderby` is malformed', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .get('/pagination')
                    .query({ orderby: 'wrong' })
                    .badRequest(CommonErrors.Pagination.FormatInvalid)
            })
        })

        // 정렬 방향이 잘못된 경우
        describe('when sort direction is invalid', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .get('/pagination')
                    .query({ orderby: 'name:wrong' })
                    .badRequest(CommonErrors.Pagination.DirectionInvalid)
            })
        })
    })

    describe('RPC controller', () => {
        // 요청이 유효한 경우
        describe('when the request is valid', () => {
            // PaginationDto를 처리한다
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
