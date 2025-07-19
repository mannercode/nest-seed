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
        // 상황: 유효한 데이터로 요청할 때
        describe('with valid data', () => {
            // 기대 결과: 새로운 고객을 생성한다.
            it('creates a new customer', async () => {
                const { createDto, expectedDto } = buildCreateCustomerDto()

                await fix.httpClient.post('/customers').body(createDto).created(expectedDto)
            })
        })

        // 상황: 이미 존재하는 이메일일 때
        describe('when the email already exists', () => {
            // 기대 결과: 409 Conflict 에러를 반환한다.
            it('returns a 409 Conflict error', async () => {
                const { createDto } = buildCreateCustomerDto()

                await fix.httpClient.post('/customers').body(createDto).created()
                await fix.httpClient
                    .post('/customers')
                    .body(createDto)
                    .conflict({ ...Errors.Customer.EmailAlreadyExists, email: createDto.email })
            })
        })

        // 상황: 필수 필드가 누락되었을 때
        describe('with missing required fields', () => {
            // 기대 결과: 400 Bad Request 에러를 반환한다.
            it('returns a 400 Bad Request error', async () => {
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

        // 상황: 유효한 데이터로 요청할 때
        describe('with valid update data', () => {
            // 기대 결과: 고객 정보를 수정한다.
            it('updates the customer details', async () => {
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

        // 상황: 빈 데이터로 업데이트 요청할 때
        describe('with an empty update payload', () => {
            // 기대 결과: 변경 없이 기존 고객 정보를 반환한다.
            it('returns the unchanged customer details', async () => {
                await fix.httpClient.patch(`/customers/${customer.id}`).body({}).ok(customer)
            })
        })

        // 상황: 존재하지 않는 고객일 때
        describe('when the customer does not exist', () => {
            // 기대 결과: 404 Not Found 에러를 반환한다.
            it('returns a 404 Not Found error', async () => {
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

        // 상황: 존재하는 고객일 때
        describe('when the customer exists', () => {
            // 기대 결과: 고객을 삭제한다.
            it('deletes the customer', async () => {
                await fix.httpClient.delete(`/customers/${customer.id}`).ok()

                await fix.httpClient.get(`/customers/${customer.id}`).notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [customer.id]
                })
            })
        })

        // 상황: 존재하지 않는 고객일 때
        describe('when the customer does not exist', () => {
            // 기대 결과: 404 Not Found 에러를 반환한다.
            it('returns a 404 Not Found error', async () => {
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

        // 상황: 존재하는 고객일 때
        describe('when the customer exists', () => {
            // 기대 결과: 고객 상세 정보를 반환한다.
            it('returns the customer details', async () => {
                await fix.httpClient.get(`/customers/${customer.id}`).ok(customer)
            })
        })

        // 상황: 존재하지 않는 고객일 때
        describe('when the customer does not exist', () => {
            // 기대 결과: 404 Not Found 에러를 반환한다.
            it('returns a 404 Not Found error', async () => {
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

        // 상황: 쿼리 파라미터 없이 요청할 때
        describe('without any query parameters', () => {
            // 기대 결과: 기본 페이지네이션으로 고객 목록을 반환한다.
            it('returns a paginated list of customers', async () => {
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

        // 상황: 유효하지 않은 쿼리 필드로 요청할 때
        describe('with an invalid query parameter', () => {
            // 기대 결과: 400 Bad Request 에러를 반환한다.
            it('returns a 400 Bad Request error', async () => {
                await fix.httpClient
                    .get('/customers')
                    .query({ wrong: 'value' })
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })

        // 상황: 부분 이름으로 필터링할 때
        describe('when filtering by a partial name', () => {
            // 기대 결과: 일치하는 고객 목록을 반환한다.
            it('returns the matching customers', async () => {
                const partialName = 'customer-a'
                const { body } = await fix.httpClient
                    .get('/customers')
                    .query({ name: partialName })
                    .ok()

                expectEqualUnsorted(body.items, [customers[0], customers[1]])
            })
        })

        // 상황: 부분 이메일로 필터링할 때
        describe('when filtering by a partial email', () => {
            // 기대 결과: 일치하는 고객 목록을 반환한다.
            it('returns the matching customers', async () => {
                const partialEmail = 'user-b'
                const { body } = await fix.httpClient
                    .get('/customers')
                    .query({ email: partialEmail })
                    .ok()

                expectEqualUnsorted(body.items, [customers[2], customers[3]])
            })
        })
    })
})
