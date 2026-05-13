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

    describe('HTTP 컨트롤러', () => {
        it('유효한 쿼리는 PaginationDto로 처리된다', async () => {
            const page = 2
            const size = 3
            const query = { size, orderby: 'name:asc', page }
            const expectedResponse = {
                response: { size, orderby: { direction: 'asc', name: 'name' }, page }
            }

            await fix.httpClient.get('/pagination').query(query).ok(expectedResponse)
        })

        it('orderby name="0"처럼 비어 있지 않은 문자열은 정상 처리된다', async () => {
            await fix.httpClient
                .get('/pagination')
                .query({ orderby: '0:asc' })
                .ok({ response: { orderby: { direction: 'asc', name: '0' } } })
        })

        it('orderby 형식이 잘못되면 400을 반환한다', async () => {
            await fix.httpClient
                .get('/pagination')
                .query({ orderby: 'wrong' })
                .badRequest(CommonErrors.Pagination.FormatInvalid())
        })

        it('정렬 방향이 유효하지 않으면 400을 반환한다', async () => {
            await fix.httpClient
                .get('/pagination')
                .query({ orderby: 'name:wrong' })
                .badRequest(CommonErrors.Pagination.DirectionInvalid())
        })

        it('direction이 대문자(ASC/DESC)이면 400을 반환한다', async () => {
            await fix.httpClient
                .get('/pagination')
                .query({ orderby: 'name:ASC' })
                .badRequest(CommonErrors.Pagination.DirectionInvalid())
        })

        it('field와 direction 양옆의 공백은 잘라낸 뒤 처리된다', async () => {
            await fix.httpClient
                .get('/pagination')
                .query({ orderby: '  name  :  asc  ' })
                .ok({ response: { orderby: { direction: 'asc', name: 'name' } } })
        })
    })

    it('orderby가 이미 객체이면 그대로 유지한다', () => {
        const orderby = { direction: 'asc', name: 'name' }
        const dto = plainToInstance(PaginationDto, { orderby })

        expect((dto as any).orderby).toEqual(orderby)
    })

    it('orderby가 null이면 그대로 유지한다', () => {
        const dto = plainToInstance(PaginationDto, { orderby: null })

        expect((dto as any).orderby).toBeNull()
    })

    it('orderby가 문자열이 아니면 BadRequestException을 던진다', () => {
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

    it('orderby의 name 또는 direction이 비어 있으면 BadRequestException을 던진다', () => {
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

    it('orderby가 ":"만 들어오면 BadRequestException을 던진다', () => {
        try {
            plainToInstance(PaginationDto, { orderby: ':' })
            throw new Error('Expected BadRequestException to be thrown')
        } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException)
            expect((error as BadRequestException).getResponse()).toEqual(
                PaginationErrors.FormatInvalid()
            )
        }
    })
})
