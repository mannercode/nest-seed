import { CustomerDto } from 'apps/cores'
import { omit } from 'lodash'
import { expectEqualUnsorted, nullObjectId } from 'testlib'
import { Errors } from '../__helpers__'
import { buildCreateCustomerDto, createCustomer } from '../common.fixture'
import { Fixture } from './customers.fixture'

describe('CustomersService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./customers.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /customers', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // 고객을 생성하고 반환한다
            it('creates and returns the customer', async () => {
                const createDto = buildCreateCustomerDto()

                await fix.httpClient
                    .post('/customers')
                    .body(createDto)
                    .created({ id: expect.any(String), ...omit(createDto, 'password') })
            })
        })

        // 이메일이 이미 존재하는 경우
        describe('when the email already exists', () => {
            // 409 Conflict를 반환한다
            it('returns 409 Conflict', async () => {
                const createDto = buildCreateCustomerDto({ email: fix.customer.email })

                await fix.httpClient
                    .post('/customers')
                    .body(createDto)
                    .conflict({ ...Errors.Customer.EmailAlreadyExists, email: createDto.email })
            })
        })

        // 필수 필드가 누락된 경우
        describe('when the required fields are missing', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .post('/customers')
                    .body({})
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })

    describe('PATCH /customers/:id', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // 고객 정보를 수정하고 반환한다
            it('updates and returns the customer', async () => {
                const updateDto = {
                    name: 'update-name',
                    email: 'new@mail.com',
                    birthDate: new Date('1900-12-31')
                }
                const expected = { ...fix.customer, ...updateDto }

                await fix.httpClient
                    .patch(`/customers/${fix.customer.id}`)
                    .body(updateDto)
                    .ok(expected)

                await fix.httpClient.get(`/customers/${fix.customer.id}`).ok(expected)
            })
        })

        // payload가 비어있는 경우
        describe('when the payload is empty', () => {
            // 원래 고객 정보를 반환한다
            it('returns the original customer', async () => {
                await fix.httpClient
                    .patch(`/customers/${fix.customer.id}`)
                    .body({})
                    .ok(fix.customer)
            })
        })

        // 고객이 존재하지 않는 경우
        describe('when the customer does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .patch(`/customers/${nullObjectId}`)
                    .body({})
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('DELETE /customers/:id', () => {
        // 고객이 존재하는 경우
        describe('when the customer exists', () => {
            // 고객을 삭제한다
            it('deletes the customer', async () => {
                await fix.httpClient
                    .delete(`/customers/${fix.customer.id}`)
                    .ok({ deletedCustomers: [fix.customer] })

                await fix.httpClient.get(`/customers/${fix.customer.id}`).notFound()
            })
        })

        // 고객이 존재하지 않는 경우
        describe('when the customer does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient.delete(`/customers/${nullObjectId}`).notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [nullObjectId]
                })
            })
        })
    })

    describe('GET /customers/:id', () => {
        // 고객이 존재하는 경우
        describe('when the customer exists', () => {
            // 고객 정보를 반환한다
            it('returns the customer', async () => {
                await fix.httpClient.get(`/customers/${fix.customer.id}`).ok(fix.customer)
            })
        })

        // 고객이 존재하지 않는 경우
        describe('when the customer does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient.get(`/customers/${nullObjectId}`).notFound({
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
                createCustomer(fix, { name: 'customer-a1', email: 'user-a1@mail.com' }),
                createCustomer(fix, { name: 'customer-a2', email: 'user-a2@mail.com' }),
                createCustomer(fix, { name: 'customer-b1', email: 'user-b1@mail.com' }),
                createCustomer(fix, { name: 'customer-b2', email: 'user-b2@mail.com' }),
                createCustomer(fix, { name: 'customer-c1', email: 'user-c1@mail.com' })
            ])

            customers = [...createdCustomers, fix.customer]
        })

        // 쿼리 파라미터가 없는 경우
        describe('when query parameters are missing', () => {
            // 기본 페이지네이션으로 고객 목록을 반환한다
            it('returns the customer list with default pagination', async () => {
                const { body } = await fix.httpClient.get('/customers').ok()
                const { items, ...pagination } = body

                expect(pagination).toEqual({
                    skip: 0,
                    take: expect.any(Number),
                    total: customers.length
                })
                expectEqualUnsorted(items, customers)
            })
        })

        // 쿼리 파라미터가 유효하지 않은 경우
        describe('when query parameters are invalid', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .get('/customers')
                    .query({ wrong: 'value' })
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })

        // `name` 부분 문자열이 제공된 경우
        describe('when a partial `name` is provided', () => {
            // 이름이 해당 부분 문자열을 포함하는 고객 목록을 반환한다
            it('returns the customer list whose name contains the given substring', async () => {
                const { body } = await fix.httpClient
                    .get('/customers')
                    .query({ name: 'customer-a' })
                    .ok()

                expectEqualUnsorted(body.items, [customers[0], customers[1]])
            })
        })

        // `email` 부분 문자열이 제공된 경우
        describe('when a partial `email` is provided', () => {
            // 이메일이 해당 부분 문자열을 포함하는 고객 목록을 반환한다
            it('returns the customer list whose email contains the given substring', async () => {
                const { body } = await fix.httpClient
                    .get('/customers')
                    .query({ email: 'user-b' })
                    .ok()

                expectEqualUnsorted(body.items, [customers[2], customers[3]])
            })
        })
    })
})
