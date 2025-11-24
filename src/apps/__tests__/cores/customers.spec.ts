import { CustomerDto } from 'apps/cores'
import { omit } from 'lodash'
import { nullObjectId } from 'testlib'
import { buildCreateCustomerDto, createCustomer, Errors } from '../__helpers__'
import type { Fixture } from './customers.fixture'

describe('CustomersService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./customers.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('POST /customers', () => {
        // payload가 유효한 경우
        describe('when payload is valid', () => {
            // 고객을 생성하고 반환한다
            it('creates and returns a customer', async () => {
                const createDto = buildCreateCustomerDto()

                await fixture.httpClient
                    .post('/customers')
                    .body(createDto)
                    .created({ id: expect.any(String), ...omit(createDto, 'password') })
            })
        })

        // 이메일이 이미 존재하는 경우
        describe('when email already exists', () => {
            // 409 Conflict를 반환한다
            it('returns 409 Conflict', async () => {
                const createDto = buildCreateCustomerDto({ email: fixture.createdCustomer.email })

                await fixture.httpClient
                    .post('/customers')
                    .body(createDto)
                    .conflict({ ...Errors.Customer.EmailAlreadyExists, email: createDto.email })
            })
        })

        // 필수 필드가 누락된 경우
        describe('when required fields are missing', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .post('/customers')
                    .body({})
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })

    describe('GET /customers/:id', () => {
        // 고객이 존재하는 경우
        describe('when customer exists', () => {
            // 고객 정보를 반환한다
            it('returns the customer', async () => {
                await fixture.httpClient
                    .get(`/customers/${fixture.createdCustomer.id}`)
                    .ok(fixture.createdCustomer)
            })
        })

        // 고객이 존재하지 않는 경우
        describe('when customer does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fixture.httpClient
                    .get(`/customers/${nullObjectId}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [nullObjectId]
                    })
            })
        })
    })

    describe('PATCH /customers/:id', () => {
        // payload가 유효한 경우
        describe('when payload is valid', () => {
            // 고객 정보를 수정하고 반환한다
            it('updates and returns the customer', async () => {
                const updateDto = {
                    name: 'update-name',
                    email: 'new@mail.com',
                    birthDate: new Date('1900-12-31')
                }
                const expected = { ...fixture.createdCustomer, ...updateDto }

                await fixture.httpClient
                    .patch(`/customers/${fixture.createdCustomer.id}`)
                    .body(updateDto)
                    .ok(expected)

                await fixture.httpClient.get(`/customers/${fixture.createdCustomer.id}`).ok(expected)
            })
        })

        // 고객이 존재하지 않는 경우
        describe('when customer does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fixture.httpClient
                    .patch(`/customers/${nullObjectId}`)
                    .body({})
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('DELETE /customers/:id', () => {
        // 고객이 존재하는 경우
        describe('when customer exists', () => {
            // 고객을 삭제한다
            it('deletes the customer', async () => {
                await fixture.httpClient
                    .delete(`/customers/${fixture.createdCustomer.id}`)
                    .ok({ deletedCustomers: [fixture.createdCustomer] })

                await fixture.httpClient.get(`/customers/${fixture.createdCustomer.id}`).notFound()
            })
        })

        // 고객이 존재하지 않는 경우
        describe('when customer does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fixture.httpClient
                    .delete(`/customers/${nullObjectId}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [nullObjectId]
                    })
            })
        })
    })

    describe('GET /customers', () => {
        let customers: CustomerDto[]

        beforeEach(async () => {
            const createdCustomers = await Promise.all([
                createCustomer(fixture, { name: 'customer-a1', email: 'user-a1@mail.com' }),
                createCustomer(fixture, { name: 'customer-a2', email: 'user-a2@mail.com' }),
                createCustomer(fixture, { name: 'customer-b1', email: 'user-b1@mail.com' }),
                createCustomer(fixture, { name: 'customer-b2', email: 'user-b2@mail.com' }),
                createCustomer(fixture, { name: 'customer-c1', email: 'user-c1@mail.com' })
            ])

            customers = [...createdCustomers, fixture.createdCustomer]
        })

        // 쿼리 파라미터가 없는 경우
        describe('when query parameters are missing', () => {
            // 기본 페이지네이션으로 고객을 반환한다
            it('returns customers with default pagination', async () => {
                await fixture.httpClient
                    .get('/customers')
                    .ok({
                        skip: 0,
                        take: expect.any(Number),
                        total: customers.length,
                        items: expect.arrayContaining(customers)
                    })
            })
        })

        // 쿼리 파라미터가 유효하지 않은 경우
        describe('when query parameters are invalid', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .get('/customers')
                    .query({ wrong: 'value' })
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })

        // `name` 부분 문자열이 제공된 경우
        describe('when partial `name` is provided', () => {
            // 이름이 해당 부분 문자열을 포함하는 고객을 반환한다
            it('returns customers whose name contains the given substring', async () => {
                await fixture.httpClient
                    .get('/customers')
                    .query({ name: 'customer-a' })
                    .ok(
                        expect.objectContaining({
                            items: expect.arrayContaining([customers[0], customers[1]])
                        })
                    )
            })
        })

        // `email` 부분 문자열이 제공된 경우
        describe('when partial `email` is provided', () => {
            // 이메일이 해당 부분 문자열을 포함하는 고객을 반환한다
            it('returns customers whose email contains the given substring', async () => {
                await fixture.httpClient
                    .get('/customers')
                    .query({ email: 'user-b' })
                    .ok(
                        expect.objectContaining({
                            items: expect.arrayContaining([customers[2], customers[3]])
                        })
                    )
            })
        })
    })
})
