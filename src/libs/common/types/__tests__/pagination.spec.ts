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

    describe('when orderby is undefined or null', () => {
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
