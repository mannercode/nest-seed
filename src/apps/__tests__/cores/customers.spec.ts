import { CustomerDto } from 'apps/cores'
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
        // 유효한 데이터가 제공된 경우
        describe('when provided valid data', () => {
            // 고객을 생성하고 반환한다
            it('creates and returns the customer', async () => {
                const { createDto, expectedDto } = buildCreateCustomerDto()
                await fix.httpClient.post('/customers').body(createDto).created(expectedDto)
            })
        })

        // 이메일이 이미 존재할 때
        describe('when the email already exists', () => {
            // 409 Conflict를 반환한다
            it('returns 409 Conflict', async () => {
                const { createDto } = buildCreateCustomerDto()

                await fix.httpClient.post('/customers').body(createDto).created()
                await fix.httpClient
                    .post('/customers')
                    .body(createDto)
                    .conflict({ ...Errors.Customer.EmailAlreadyExists, email: createDto.email })
            })
        })

        // 필수 필드가 누락되었을 때
        describe('when required fields are missing', () => {
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
        let customer: CustomerDto

        beforeEach(async () => {
            customer = await createCustomer(fix)
        })

        // 유효한 데이터가 제공된 경우
        describe('when provided valid data', () => {
            // 고객 정보를 수정한다
            it('updates the customer', async () => {
                const updateDto = {
                    name: 'update-name',
                    email: 'new@mail.com',
                    birthDate: new Date('1900-12-31')
                }
                const expected = { ...customer, ...updateDto }

                await fix.httpClient.patch(`/customers/${customer.id}`).body(updateDto).ok(expected)
                await fix.httpClient.get(`/customers/${customer.id}`).ok(expected)
            })
        })

        // 페이로드가 비어있을 때
        describe('when the payload is empty', () => {
            // 원래 고객 정보를 반환한다
            it('returns the original customer', async () => {
                await fix.httpClient.patch(`/customers/${customer.id}`).body({}).ok(customer)
            })
        })

        // 고객이 존재하지 않을 때
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
        let customer: CustomerDto

        beforeEach(async () => {
            customer = await createCustomer(fix)
        })

        // 고객이 존재할 때
        describe('when the customer exists', () => {
            // 고객을 삭제한다
            it('deletes the customer', async () => {
                await fix.httpClient.delete(`/customers/${customer.id}`).ok()

                await fix.httpClient.get(`/customers/${customer.id}`).notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [customer.id]
                })
            })
        })

        // 고객이 존재하지 않을 때
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
        let customer: CustomerDto

        beforeEach(async () => {
            customer = await createCustomer(fix)
        })

        // 고객이 존재할 때
        describe('when the customer exists', () => {
            // 고객 정보를 반환한다
            it('returns the customer', async () => {
                await fix.httpClient.get(`/customers/${customer.id}`).ok(customer)
            })
        })

        // 고객이 존재하지 않을 때
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
            customers = await Promise.all([
                createCustomer(fix, { name: 'customer-a1', email: 'user-a1@mail.com' }),
                createCustomer(fix, { name: 'customer-a2', email: 'user-a2@mail.com' }),
                createCustomer(fix, { name: 'customer-b1', email: 'user-b1@mail.com' }),
                createCustomer(fix, { name: 'customer-b2', email: 'user-b2@mail.com' }),
                createCustomer(fix, { name: 'customer-c1', email: 'user-c1@mail.com' })
            ])
        })

        // 쿼리 파라미터 없이 요청한 경우
        describe('without any query parameters', () => {
            // 기본 페이지네이션으로 고객을 반환한다
            it('returns customers with default pagination', async () => {
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

        // 다양한 조건으로 필터링할 때
        describe('when filtering with various criteria', () => {
            // 이름으로 고객을 필터링한다
            it('filters customers by partial name', async () => {
                const { body } = await fix.httpClient
                    .get('/customers')
                    .query({ name: 'customer-a' })
                    .ok()

                expectEqualUnsorted(body.items, [customers[0], customers[1]])
            })

            // 이메일로 고객을 필터링한다
            it('filters customers by partial email', async () => {
                const { body } = await fix.httpClient
                    .get('/customers')
                    .query({ email: 'user-b' })
                    .ok()

                expectEqualUnsorted(body.items, [customers[2], customers[3]])
            })
        })

        // 잘못된 쿼리 파라미터를 제공한 경우
        describe('with an invalid query parameter', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .get('/customers')
                    .query({ wrong: 'value' })
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })
})
