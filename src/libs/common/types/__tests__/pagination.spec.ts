import { BadRequestException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { CommonErrors } from 'common'
import { withTestId } from 'testlib'
import type { PaginationFixture } from './pagination.fixture'
import { PaginationDto, PaginationErrors } from '..'

describe('PaginationDto', () => {
    let fix: PaginationFixture

    beforeEach(async () => {
        const { createPaginationFixture } = await import('./pagination.fixture')
        fix = await createPaginationFixture()
    })
    afterEach(() => fix.teardown())

    describe('HTTP controller', () => {
        // 요청이 유효할 때
        describe('when the request is valid', () => {
            let skip: number
            let take: number
            let query: Record<string, any>
            let expectedResponse: Record<string, any>

            beforeEach(() => {
                skip = 2
                take = 3
                query = { orderby: 'name:asc', skip, take }
                expectedResponse = {
                    response: { orderby: { direction: 'asc', name: 'name' }, skip, take }
                }
            })

            // PaginationDto를 처리한다
            it('handles PaginationDto', async () => {
                await fix.httpClient.get('/pagination').query(query).ok(expectedResponse)
            })
        })

        // `orderby`가 올바르지 않을 때
        describe('when `orderby` is malformed', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .get('/pagination')
                    .query({ orderby: 'wrong' })
                    .badRequest(CommonErrors.Pagination.FormatInvalid())
            })
        })

        // 정렬 방향이 유효하지 않을 때
        describe('when the sort direction is invalid', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .get('/pagination')
                    .query({ orderby: 'name:wrong' })
                    .badRequest(CommonErrors.Pagination.DirectionInvalid())
            })
        })
    })

    describe('RPC controller', () => {
        // 요청이 유효할 때
        describe('when the request is valid', () => {
            let input: Record<string, any>

            beforeEach(() => {
                const skip = 2
                const take = 3
                input = { orderby: { direction: 'asc', name: 'name' }, skip, take }
            })

            // PaginationDto를 처리한다
            it('handles PaginationDto', async () => {
                await fix.rpcClient.expectRequest(withTestId('getRpcPagination'), input, {
                    response: input
                })
            })
        })
    })

    // orderby가 제공되지 않을 때
    describe('when orderby is not provided', () => {
        // 값을 그대로 유지한다
        it('keeps the value as-is', () => {
            const dto = plainToInstance(PaginationDto, { orderby: null })

            expect((dto as any).orderby).toBeNull()
        })
    })

    // orderby가 문자열이 아닐 때
    describe('when orderby is not a string', () => {
        // BadRequestException을 던진다
        it('throws BadRequestException', () => {
            try {
                plainToInstance(PaginationDto, { orderby: 123 as any })
                throw new Error('Expected BadRequestException to be thrown')
            } catch (error) {
                expect(error).toBeInstanceOf(BadRequestException)
                expect((error as BadRequestException).getResponse()).toEqual(
                    PaginationErrors.FormatInvalid()
                )
            }
        })
    })

    // orderby의 name 또는 direction이 비어 있을 때
    describe('when orderby has an empty name or direction', () => {
        // BadRequestException을 던진다
        it('throws BadRequestException', () => {
            try {
                plainToInstance(PaginationDto, { orderby: 'name:' })
                throw new Error('Expected BadRequestException to be thrown')
            } catch (error) {
                expect(error).toBeInstanceOf(BadRequestException)
                expect((error as BadRequestException).getResponse()).toEqual(
                    PaginationErrors.FormatInvalid()
                )
            }
        })
    })
})
