import { BadRequestException } from '@nestjs/common'
import { type PaginationFixture, createPaginationFixture } from './pagination.fixture.js'
import { CommonErrors } from '../../index.js'
import { PaginationErrors, PaginationSchema } from '../index.js'

describe('PaginationDto', () => {
    let fix: PaginationFixture

    beforeEach(async () => {
        fix = await createPaginationFixture()
    })
    afterEach(() => fix.teardown())

    describe('GET /pagination', () => {
        describe('페이지·크기·정렬 조건이 유효하면', () => {
            let request: typeof fix.httpClient
            let page: number
            let size: number
            beforeEach(() => {
                page = 2
                size = 3
                const query = { size, orderby: 'name:asc', page }
                request = fix.httpClient.get('/pagination').query(query)
            })
            it('페이지 조건을 요청하면 PaginationDto로 변환해 반환한다', async () => {
                const expectedResponse = {
                    response: { size, orderby: { direction: 'asc', name: 'name' }, page }
                }

                await request.ok({ expected: expectedResponse })
            })
        })

        describe('정렬 필드 이름이 문자열 "0"이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/pagination').query({ orderby: '0:asc' })
            })
            it('페이지 조건을 요청하면 필드 이름을 유지한다', async () => {
                await request.ok({
                    expected: { response: { orderby: { direction: 'asc', name: '0' } } }
                })
            })
        })

        describe('orderby 형식이 잘못되었으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/pagination').query({ orderby: 'wrong' })
            })
            it('페이지 조건을 요청하면 400을 반환한다', async () => {
                await request.badRequest({ expected: CommonErrors.Pagination.FormatInvalid() })
            })
        })

        describe('정렬 방향이 유효하지 않으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/pagination').query({ orderby: 'name:wrong' })
            })
            it('페이지 조건을 요청하면 400을 반환한다', async () => {
                await request.badRequest({ expected: CommonErrors.Pagination.DirectionInvalid() })
            })
        })

        describe('정렬 방향이 대문자 ASC이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/pagination').query({ orderby: 'name:ASC' })
            })
            it('페이지 조건을 요청하면 400을 반환한다', async () => {
                await request.badRequest({ expected: CommonErrors.Pagination.DirectionInvalid() })
            })
        })

        describe('정렬 필드와 방향 양옆에 공백이 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/pagination').query({ orderby: '  name  :  asc  ' })
            })
            it('페이지 조건을 요청하면 공백을 제거해 반환한다', async () => {
                await request.ok({
                    expected: { response: { orderby: { direction: 'asc', name: 'name' } } }
                })
            })
        })

        describe('page가 0이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/pagination').query({ page: 0, size: 10 })
            })
            it('페이지 조건을 요청하면 400을 반환한다', async () => {
                // 저장소는 size만 가드하므로 비양수 page는 DTO 검증이 유일한 방어선이다.
                await request.badRequest()
            })
        })

        describe('정의하지 않은 쿼리 파라미터가 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/pagination').query({ unknown: 'value' })
            })
            it('페이지 조건을 요청하면 400을 반환한다', async () => {
                await request.badRequest()
            })
        })
    })

    describe('orderby가 올바른 객체이면', () => {
        let orderby: { direction: string; name: string }
        let input: unknown
        beforeEach(() => {
            orderby = { direction: 'asc', name: 'name' }
            input = { orderby }
        })
        it('페이지 조건을 변환하면 객체 값을 유지한다', () => {
            const dto = PaginationSchema.parse(input)

            expect(dto.orderby).toEqual(orderby)
        })
    })

    describe('orderby 객체에 name과 direction이 없으면', () => {
        let input: unknown
        beforeEach(() => {
            input = { orderby: { evil: 'x' } }
        })
        it('페이지 조건을 변환하면 BadRequestException을 던진다', () => {
            expect(() => PaginationSchema.parse(input)).toThrow(BadRequestException)
        })
    })

    describe('orderby가 배열이면', () => {
        let input: unknown
        beforeEach(() => {
            input = { orderby: ['name:asc', 'name:desc'] }
        })
        it('페이지 조건을 변환하면 BadRequestException을 던진다', () => {
            expect(() => PaginationSchema.parse(input)).toThrow(BadRequestException)
        })
    })

    describe('orderby가 null이면', () => {
        let input: unknown
        beforeEach(() => {
            input = { orderby: null }
        })
        it('페이지 조건을 변환하면 null을 유지한다', () => {
            const dto = PaginationSchema.parse(input)

            expect(dto.orderby).toBeNull()
        })
    })

    describe('orderby가 숫자이면', () => {
        let input: unknown
        beforeEach(() => {
            input = { orderby: 123 }
        })
        it('페이지 조건을 변환하면 BadRequestException을 던진다', () => {
            try {
                PaginationSchema.parse(input)
                throw new Error('Expected BadRequestException to be thrown')
            } catch (error) {
                expect(error).toBeInstanceOf(BadRequestException)
                expect((error as BadRequestException).getResponse()).toEqual(
                    PaginationErrors.FormatInvalid()
                )
            }
        })
    })

    describe('orderby의 정렬 방향이 비어 있으면', () => {
        let input: unknown
        beforeEach(() => {
            input = { orderby: 'name:' }
        })
        it('페이지 조건을 변환하면 BadRequestException을 던진다', () => {
            try {
                PaginationSchema.parse(input)
                throw new Error('Expected BadRequestException to be thrown')
            } catch (error) {
                expect(error).toBeInstanceOf(BadRequestException)
                expect((error as BadRequestException).getResponse()).toEqual(
                    PaginationErrors.FormatInvalid()
                )
            }
        })
    })

    describe('orderby가 ":"이면', () => {
        let input: unknown
        beforeEach(() => {
            input = { orderby: ':' }
        })
        it('페이지 조건을 변환하면 BadRequestException을 던진다', () => {
            try {
                PaginationSchema.parse(input)
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
