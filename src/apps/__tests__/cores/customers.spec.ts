import { omit } from 'lodash'
import { nullObjectId } from 'testlib'
import { buildCreateCustomerDto, createCustomer, Errors } from '../__helpers__'
import type { CustomersFixture } from './customers.fixture'
import type { CustomerDto, SearchCustomersPageDto } from 'apps/cores'

describe('CustomersService', () => {
    let fix: CustomersFixture

    beforeEach(async () => {
        const { createCustomersFixture } = await import('./customers.fixture')
        fix = await createCustomersFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /customers', () => {
        // 생성된 고객을 반환한다
        it('returns the created customer', async () => {
            const createDto = buildCreateCustomerDto()

            await fix.httpClient
                .post('/customers')
                .body(createDto)
                .created({ ...omit(createDto, ['password']), id: expect.any(String) })
        })

        // 이메일이 이미 존재할 때
        describe('when the email already exists', () => {
            const email = 'user@mail.com'

            beforeEach(async () => {
                await createCustomer(fix, { email })
            })

            // 409 Conflict를 반환한다
            it('returns 409 Conflict', async () => {
                const createDto = buildCreateCustomerDto({ email })

                await fix.httpClient
                    .post('/customers')
                    .body(createDto)
                    .conflict({ ...Errors.Customers.EmailAlreadyExists, email: createDto.email })
            })
        })

        // 필수 필드가 누락된 경우
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

    describe('GET /customers/:id', () => {
        // 고객이 존재할 때
        describe('when the customer exists', () => {
            let customer: CustomerDto

            beforeEach(async () => {
                customer = await createCustomer(fix)
            })

            // 고객을 반환한다
            it('returns the customer', async () => {
                await fix.httpClient.get(`/customers/${customer.id}`).ok(customer)
            })
        })

        // 고객이 존재하지 않을 때
        describe('when the customer does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .get(`/customers/${nullObjectId}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [nullObjectId]
                    })
            })
        })
    })

    describe('PATCH /customers/:id', () => {
        // 고객이 존재할 때
        describe('when the customer exists', () => {
            let customer: CustomerDto

            beforeEach(async () => {
                customer = await createCustomer(fix, { name: 'original-name' })
            })

            // 수정된 고객을 반환한다
            it('returns the updated customer', async () => {
                const updateDto = { email: 'new@mail.com', birthDate: new Date('1900-12-31') }

                await fix.httpClient
                    .patch(`/customers/${customer.id}`)
                    .body(updateDto)
                    .ok({ ...customer, ...updateDto })
            })

            // 수정 내용이 저장된다
            it('persists the update', async () => {
                const updateDto = { name: 'update-name' }
                await fix.httpClient.patch(`/customers/${customer.id}`).body(updateDto).ok()

                await fix.httpClient
                    .get(`/customers/${customer.id}`)
                    .ok({ ...customer, ...updateDto })
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
        // 고객이 존재할 때
        describe('when the customer exists', () => {
            let customer: CustomerDto

            beforeEach(async () => {
                customer = await createCustomer(fix)
            })

            // 204 No Content를 반환한다
            it('returns 204 No Content', async () => {
                await fix.httpClient.delete(`/customers/${customer.id}`).noContent()
            })

            // 삭제가 저장된다
            it('persists the deletion', async () => {
                await fix.httpClient.delete(`/customers/${customer.id}`).noContent()

                await fix.httpClient
                    .get(`/customers/${customer.id}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [customer.id]
                    })
            })
        })

        // 고객이 존재하지 않을 때
        describe('when the customer does not exist', () => {
            // 204 No Content를 반환한다
            it('returns 204 No Content', async () => {
                await fix.httpClient.delete(`/customers/${nullObjectId}`).noContent()
            })
        })
    })

    describe('GET /customers', () => {
        let customerA1: CustomerDto
        let customerA2: CustomerDto
        let customerB1: CustomerDto
        let customerB2: CustomerDto

        beforeEach(async () => {
            ;[customerA1, customerA2, customerB1, customerB2] = await Promise.all([
                createCustomer(fix, { name: 'customer-a1', email: 'user-a1@mail.com' }),
                createCustomer(fix, { name: 'customer-a2', email: 'user-a2@mail.com' }),
                createCustomer(fix, { name: 'customer-b1', email: 'user-b1@mail.com' }),
                createCustomer(fix, { name: 'customer-b2', email: 'user-b2@mail.com' })
            ])
        })

        const buildExpectedPage = (customers: CustomerDto[]) => ({
            skip: 0,
            take: expect.any(Number),
            total: customers.length,
            items: expect.arrayContaining(customers)
        })

        // 쿼리가 제공되지 않을 때
        describe('when the query is not provided', () => {
            // 기본 고객 페이지를 반환한다
            it('returns the default page of customers', async () => {
                const expected = buildExpectedPage([customerA1, customerA2, customerB1, customerB2])

                await fix.httpClient.get('/customers').ok(expected)
            })
        })

        // 필터가 제공될 때
        describe('when the filter is provided', () => {
            const queryAndExpect = (query: SearchCustomersPageDto, customers: CustomerDto[]) =>
                fix.httpClient.get('/customers').query(query).ok(buildExpectedPage(customers))

            // 부분 이름 일치로 필터링된 고객을 반환한다
            it('returns customers filtered by a partial name match', async () => {
                await queryAndExpect({ name: 'customer-a' }, [customerA1, customerA2])
            })

            // 부분 이메일 일치로 필터링된 고객을 반환한다
            it('returns customers filtered by a partial email match', async () => {
                await queryAndExpect({ email: 'user-b' }, [customerB1, customerB2])
            })
        })

        // 쿼리 파라미터가 유효하지 않을 때
        describe('when the query parameters are invalid', () => {
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
