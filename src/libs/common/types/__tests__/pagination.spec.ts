import { BadRequestException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { CommonErrors } from 'common'
import { withTestId } from 'testlib'
import { PaginationDto, PaginationErrors } from '..'
import { type PaginationFixture } from './pagination.fixture'

describe('PaginationDto', () => {
    let fix: PaginationFixture

    beforeEach(async () => {
        const { createPaginationFixture } = await import('./pagination.fixture')
        fix = await createPaginationFixture()
    })
    afterEach(() => fix.teardown())

    describe('HTTP controller', () => {
        describe('when the request is valid', () => {
            let skip: number
            let take: number
            let query: Record<string, any>
            let expectedResponse: Record<string, any>

            beforeEach(() => {
                skip = 2
                take = 3
                query = { skip, take, orderby: 'name:asc' }
                expectedResponse = {
                    response: { orderby: { direction: 'asc', name: 'name' }, skip, take }
                }
            })

            it('handles PaginationDto', async () => {
                await fix.httpClient.get('/pagination').query(query).ok(expectedResponse)
            })
        })

        describe('when `orderby` is malformed', () => {
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
            let input: Record<string, any>

            beforeEach(() => {
                const skip = 2
                const take = 3
                input = { orderby: { direction: 'asc', name: 'name' }, skip, take }
            })

            it('handles PaginationDto', async () => {
                await fix.rpcClient.expect(withTestId('getRpcPagination'), input, {
                    response: input
                })
            })
        })
    })

    describe('when orderby is not provided', () => {
        it('keeps the value as-is', () => {
            const dto = plainToInstance(PaginationDto, { orderby: null })

            expect((dto as any).orderby).toBeNull()
        })
    })

    describe('when orderby is not a string', () => {
        it('throws BadRequestException', () => {
            try {
                plainToInstance(PaginationDto, { orderby: 123 as any })
                throw new Error('Expected BadRequestException to be thrown')
            } catch (error) {
                expect(error).toBeInstanceOf(BadRequestException)
                expect((error as BadRequestException).getResponse()).toEqual(
                    PaginationErrors.FormatInvalid
                )
            }
        })
    })

    describe('when orderby has an empty name or direction', () => {
        it('throws BadRequestException', () => {
            try {
                plainToInstance(PaginationDto, { orderby: 'name:' })
                throw new Error('Expected BadRequestException to be thrown')
            } catch (error) {
                expect(error).toBeInstanceOf(BadRequestException)
                expect((error as BadRequestException).getResponse()).toEqual(
                    PaginationErrors.FormatInvalid
                )
            }
        })
    })
})
