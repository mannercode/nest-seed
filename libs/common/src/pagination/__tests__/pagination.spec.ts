import { BadRequestException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import type { PaginationFixture } from './pagination.fixture'
import { PaginationDto, PaginationErrors } from '..'
import { CommonErrors } from '../../errors'

describe('PaginationDto', () => {
    let fix: PaginationFixture

    beforeEach(async () => {
        const { createPaginationFixture } = await import('./pagination.fixture')
        fix = await createPaginationFixture()
    })
    afterEach(() => fix.teardown())

    describe('HTTP controller', () => {
        describe('요청이 유효할 때', () => {
            let page: number
            let size: number
            let query: Record<string, any>
            let expectedResponse: Record<string, any>

            beforeEach(() => {
                page = 2
                size = 3
                query = { size, orderby: 'name:asc', page }
                expectedResponse = {
                    response: { size, orderby: { direction: 'asc', name: 'name' }, page }
                }
            })

            it('PaginationDto를 처리한다', async () => {
                await fix.httpClient.get('/pagination').query(query).ok(expectedResponse)
            })
        })

        describe('`orderby`가 올바르지 않을 때', () => {
            it('400 Bad Request를 반환한다', async () => {
                await fix.httpClient
                    .get('/pagination')
                    .query({ orderby: 'wrong' })
                    .badRequest(CommonErrors.Pagination.FormatInvalid())
            })
        })

        describe('정렬 방향이 유효하지 않을 때', () => {
            it('400 Bad Request를 반환한다', async () => {
                await fix.httpClient
                    .get('/pagination')
                    .query({ orderby: 'name:wrong' })
                    .badRequest(CommonErrors.Pagination.DirectionInvalid())
            })
        })
    })

    describe('orderby가 이미 객체일 때', () => {
        it('값을 그대로 반환한다', () => {
            const orderby = { direction: 'asc', name: 'name' }
            const dto = plainToInstance(PaginationDto, { orderby })

            expect((dto as any).orderby).toEqual(orderby)
        })
    })

    describe('orderby가 제공되지 않을 때', () => {
        it('값을 그대로 유지한다', () => {
            const dto = plainToInstance(PaginationDto, { orderby: null })

            expect((dto as any).orderby).toBeNull()
        })
    })

    describe('orderby가 문자열이 아닐 때', () => {
        it('BadRequestException을 던진다', () => {
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

    describe('orderby의 name 또는 direction이 비어 있을 때', () => {
        it('BadRequestException을 던진다', () => {
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
