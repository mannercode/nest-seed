import { CustomerDto } from 'apps/cores'
import { nullObjectId } from 'testlib'
import { buildCreateCustomerDto, createCustomer, Errors } from '../__helpers__'
import type { CustomersFixture } from './customers.fixture'

describe('CustomersService', () => {
    let fixture: CustomersFixture

    beforeEach(async () => {
        const { createCustomersFixture } = await import('./customers.fixture')
        fixture = await createCustomersFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('POST /customers', () => {
        describe('when the payload is valid', () => {
            const payload = buildCreateCustomerDto()

            it('returns 201 with the created customer', async () => {
                const { password: _, ...expectedCustomer } = payload

                await fixture.httpClient
                    .post('/customers')
                    .body(payload)
                    .created({ ...expectedCustomer, id: expect.any(String) })
            })
        })

        describe('when the email already exists', () => {
            let customer: CustomerDto

            beforeEach(async () => {
                customer = await createCustomer(fixture, { email: 'user@mail.com' })
            })

            it('returns 409 Conflict', async () => {
                const payload = buildCreateCustomerDto({ email: customer.email })

                await fixture.httpClient
                    .post('/customers')
                    .body(payload)
                    .conflict({ ...Errors.Customer.EmailAlreadyExists, email: payload.email })
            })
        })

        describe('when the required fields are missing', () => {
            const invalidPayload = {}

            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .post('/customers')
                    .body(invalidPayload)
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })

    describe('GET /customers/:id', () => {
        describe('when the customer exists', () => {
            let customer: CustomerDto

            beforeEach(async () => {
                customer = await createCustomer(fixture)
            })

            it('returns 200 with the customer', async () => {
                await fixture.httpClient.get(`/customers/${customer.id}`).ok(customer)
            })
        })

        describe('when the customer does not exist', () => {
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
        describe('when the payload is valid', () => {
            let customer: CustomerDto
            let updateDto: any

            beforeEach(async () => {
                customer = await createCustomer(fixture)
                updateDto = {
                    name: 'update-name',
                    email: 'new@mail.com',
                    birthDate: new Date('1900-12-31')
                }
            })

            it('returns 200 with the updated customer', async () => {
                const expected = { ...customer, ...updateDto }

                await fixture.httpClient
                    .patch(`/customers/${customer.id}`)
                    .body(updateDto)
                    .ok(expected)

                await fixture.httpClient.get(`/customers/${customer.id}`).ok(expected)
            })
        })

        describe('when the customer does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fixture.httpClient
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
                customer = await createCustomer(fixture)
            })

            it('returns 200 with the deleted customer', async () => {
                await fixture.httpClient
                    .delete(`/customers/${customer.id}`)
                    .ok({ deletedCustomers: [customer] })

                await fixture.httpClient
                    .get(`/customers/${customer.id}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [customer.id]
                    })
            })
        })

        describe('when the customer does not exist', () => {
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
        let customerA1: CustomerDto
        let customerA2: CustomerDto
        let customerB1: CustomerDto
        let customerB2: CustomerDto

        beforeEach(async () => {
            ;[customerA1, customerA2, customerB1, customerB2] = await Promise.all([
                createCustomer(fixture, { name: 'customer-a1', email: 'user-a1@mail.com' }),
                createCustomer(fixture, { name: 'customer-a2', email: 'user-a2@mail.com' }),
                createCustomer(fixture, { name: 'customer-b1', email: 'user-b1@mail.com' }),
                createCustomer(fixture, { name: 'customer-b2', email: 'user-b2@mail.com' })
            ])
        })

        const buildExpectedPage = (customers: CustomerDto[]) => ({
            skip: 0,
            take: expect.any(Number),
            total: customers.length,
            items: expect.arrayContaining(customers)
        })

        describe('when no query parameters are provided', () => {
            it('returns 200 with the default page of customers', async () => {
                const expected = buildExpectedPage([customerA1, customerA2, customerB1, customerB2])

                await fixture.httpClient.get('/customers').ok(expected)
            })
        })

        describe('when query parameters are provided', () => {
            const queryAndExpect = (query: any, customers: CustomerDto[]) =>
                fixture.httpClient.get('/customers').query(query).ok(buildExpectedPage(customers))

            it('returns customers filtered by a partial name match', async () => {
                await queryAndExpect({ name: 'customer-a' }, [customerA1, customerA2])
            })

            it('returns customers filtered by a partial email match', async () => {
                await queryAndExpect({ email: 'user-b' }, [customerB1, customerB2])
            })
        })

        describe('when the query parameters are invalid', () => {
            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .get('/customers')
                    .query({ wrong: 'value' })
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })
})
