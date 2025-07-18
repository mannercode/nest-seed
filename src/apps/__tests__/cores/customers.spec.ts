import { CustomerDto } from 'apps/cores'
import { expectEqualUnsorted, nullObjectId } from 'testlib'
import { Errors } from '../__helpers__'
import { buildCreateCustomerDto, createCustomer } from '../common.fixture'
import { Fixture } from './customers.fixture'

describe('Customers', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./customers.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /customers', () => {
        // 고객을 생성해야 한다
        it('Should create a customer', async () => {
            const { createDto, expectedDto } = buildCreateCustomerDto()

            await fix.httpClient.post('/customers').body(createDto).created(expectedDto)
        })

        // 이메일이 이미 존재하면 CONFLICT(409)를 반환해야 한다
        it('Should return CONFLICT(409) if the email already exists', async () => {
            const { createDto } = buildCreateCustomerDto()

            await fix.httpClient.post('/customers').body(createDto).created()
            await fix.httpClient
                .post('/customers')
                .body(createDto)
                .conflict({ ...Errors.Customer.EmailAlreadyExists, email: createDto.email })
        })

        // 필수 필드가 누락되면 BAD_REQUEST(400)를 반환해야 한다
        it('Should return BAD_REQUEST(400) if required fields are missing', async () => {
            await fix.httpClient
                .post('/customers')
                .body({})
                .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
        })
    })

    describe('PATCH /customers/:id', () => {
        let customer: CustomerDto

        beforeEach(async () => {
            customer = await createCustomer(fix)
        })

        // 고객 정보를 업데이트해야 한다
        it('Should update customer details', async () => {
            const updateDto = {
                name: 'update-name',
                email: 'new@mail.com',
                birthDate: new Date('1900-12-31')
            }
            const expected = { ...customer, ...updateDto }

            await fix.httpClient.patch(`/customers/${customer.id}`).body(updateDto).ok(expected)
            await fix.httpClient.get(`/customers/${customer.id}`).ok(expected)
        })

        it('dummy test for coverage', async () => {
            await fix.httpClient.patch(`/customers/${customer.id}`).body({}).ok(customer)
        })

        // 고객이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다
        it('Should return NOT_FOUND(404) if the customer does not exist', async () => {
            await fix.httpClient
                .patch(`/customers/${nullObjectId}`)
                .body({})
                .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
        })
    })

    describe('DELETE /customers/:id', () => {
        let customer: CustomerDto

        beforeEach(async () => {
            customer = await createCustomer(fix)
        })

        // 고객을 삭제해야 한다
        it('Should delete the customer', async () => {
            await fix.httpClient.delete(`/customers/${customer.id}`).ok()

            await fix.httpClient.get(`/customers/${customer.id}`).notFound({
                ...Errors.Mongoose.MultipleDocumentsNotFound,
                notFoundIds: [customer.id]
            })
        })

        // 고객이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다
        it('Should return NOT_FOUND(404) if the customer does not exist', async () => {
            await fix.httpClient.delete(`/customers/${nullObjectId}`).notFound({
                ...Errors.Mongoose.MultipleDocumentsNotFound,
                notFoundIds: [nullObjectId]
            })
        })
    })

    describe('GET /customers/:id', () => {
        let customer: CustomerDto

        beforeEach(async () => {
            customer = await createCustomer(fix)
        })

        // 고객 상세 정보를 반환해야 한다
        it('Should return customer details', async () => {
            await fix.httpClient.get(`/customers/${customer.id}`).ok(customer)
        })

        // 고객이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다
        it('Should return NOT_FOUND(404) if the customer does not exist', async () => {
            await fix.httpClient.get(`/customers/${nullObjectId}`).notFound({
                ...Errors.Mongoose.MultipleDocumentsNotFound,
                notFoundIds: [nullObjectId]
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

        // 기본 페이지네이션으로 고객 목록을 반환해야 한다
        it('Should return customers with default pagination', async () => {
            const { body } = await fix.httpClient.get('/customers').ok()
            const { items, ...paginated } = body

            expect(paginated).toEqual({
                skip: 0,
                take: expect.any(Number),
                total: customers.length
            })
            expectEqualUnsorted(items, customers)
        })

        // 잘못된 쿼리 필드가 제공되면 BAD_REQUEST(400)를 반환해야 한다
        it('Should return BAD_REQUEST(400) if an invalid query field is provided', async () => {
            await fix.httpClient
                .get('/customers')
                .query({ wrong: 'value' })
                .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
        })

        // 이름의 일부로 고객 목록을 반환해야 한다
        it('Should return customers filtered by partial name', async () => {
            const partialName = 'customer-a'
            const { body } = await fix.httpClient
                .get('/customers')
                .query({ name: partialName })
                .ok()

            expectEqualUnsorted(body.items, [customers[0], customers[1]])
        })

        // 이메일의 일부로 고객 목록을 반환해야 한다
        it('Should return customers filtered by partial email', async () => {
            const partialEmail = 'user-b'
            const { body } = await fix.httpClient
                .get('/customers')
                .query({ email: partialEmail })
                .ok()

            expectEqualUnsorted(body.items, [customers[2], customers[3]])
        })
    })
})
