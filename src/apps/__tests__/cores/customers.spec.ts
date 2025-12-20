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
        it('returns the created customer', async () => {
            const createDto = buildCreateCustomerDto()

            await fix.httpClient
                .post('/customers')
                .body(createDto)
                .created({ ...omit(createDto, ['password']), id: expect.any(String) })
        })

        describe('when the email already exists', () => {
            const email = 'user@mail.com'

            beforeEach(async () => {
                await createCustomer(fix, { email })
            })

            it('returns 409 Conflict', async () => {
                const createDto = buildCreateCustomerDto({ email })

                await fix.httpClient
                    .post('/customers')
                    .body(createDto)
                    .conflict({ ...Errors.Customer.EmailAlreadyExists, email: createDto.email })
            })
        })

        describe('when required fields are missing', () => {
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .post('/customers')
                    .body({})
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })

    describe('GET /customers/:id', () => {
        describe('when the customer exists', () => {
            let customer: CustomerDto

            beforeEach(async () => {
                customer = await createCustomer(fix)
            })

            it('returns the customer', async () => {
                await fix.httpClient.get(`/customers/${customer.id}`).ok(customer)
            })
        })

        describe('when the customer does not exist', () => {
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
        describe('when the customer exists', () => {
            let customer: CustomerDto

            beforeEach(async () => {
                customer = await createCustomer(fix, { name: 'original-name' })
            })

            it('returns the updated customer', async () => {
                const updateDto = { email: 'new@mail.com', birthDate: new Date('1900-12-31') }

                await fix.httpClient
                    .patch(`/customers/${customer.id}`)
                    .body(updateDto)
                    .ok({ ...customer, ...updateDto })
            })

            it('persists the update', async () => {
                const updateDto = { name: 'update-name' }
                await fix.httpClient.patch(`/customers/${customer.id}`).body(updateDto).ok()

                await fix.httpClient
                    .get(`/customers/${customer.id}`)
                    .ok({ ...customer, ...updateDto })
            })
        })

        describe('when the customer does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .patch(`/customers/${nullObjectId}`)
                    .body({})
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('DELETE /customers/:id', () => {
        describe('when the customer exists', () => {
            let customer: CustomerDto

            beforeEach(async () => {
                customer = await createCustomer(fix)
            })

            it('returns the deleted customer', async () => {
                await fix.httpClient
                    .delete(`/customers/${customer.id}`)
                    .ok({ deletedCustomers: [customer] })
            })

            it('persists the deletion', async () => {
                await fix.httpClient.delete(`/customers/${customer.id}`).ok()

                await fix.httpClient
                    .get(`/customers/${customer.id}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [customer.id]
                    })
            })
        })

        describe('when the customer does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .delete(`/customers/${nullObjectId}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [nullObjectId]
                    })
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

        describe('when the query is not provided', () => {
            it('returns the default page of customers', async () => {
                const expected = buildExpectedPage([customerA1, customerA2, customerB1, customerB2])

                await fix.httpClient.get('/customers').ok(expected)
            })
        })

        describe('when the filter is provided', () => {
            const queryAndExpect = (query: SearchCustomersPageDto, customers: CustomerDto[]) =>
                fix.httpClient.get('/customers').query(query).ok(buildExpectedPage(customers))

            it('returns customers filtered by a partial name match', async () => {
                await queryAndExpect({ name: 'customer-a' }, [customerA1, customerA2])
            })

            it('returns customers filtered by a partial email match', async () => {
                await queryAndExpect({ email: 'user-b' }, [customerB1, customerB2])
            })
        })

        describe('when the query parameters are invalid', () => {
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .get('/customers')
                    .query({ wrong: 'value' })
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })
})
