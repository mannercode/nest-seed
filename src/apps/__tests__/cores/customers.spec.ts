import { CustomerDto } from 'apps/cores'
import { omit } from 'lodash'
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
            it('creates and returns a customer', async () => {
                const createDto = buildCreateCustomerDto()

                await fixture.httpClient
                    .post('/customers')
                    .body(createDto)
                    .created({ id: expect.any(String), ...omit(createDto, 'password') })
            })
        })

        describe('when the email already exists', () => {
            it('returns 409 Conflict', async () => {
                const createDto = buildCreateCustomerDto({ email: fixture.createdCustomer.email })

                await fixture.httpClient
                    .post('/customers')
                    .body(createDto)
                    .conflict({ ...Errors.Customer.EmailAlreadyExists, email: createDto.email })
            })
        })

        describe('when the required fields are missing', () => {
            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .post('/customers')
                    .body({})
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })

    describe('GET /customers/:id', () => {
        describe('when the customer exists', () => {
            it('returns the customer', async () => {
                await fixture.httpClient
                    .get(`/customers/${fixture.createdCustomer.id}`)
                    .ok(fixture.createdCustomer)
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

                await fixture.httpClient
                    .get(`/customers/${fixture.createdCustomer.id}`)
                    .ok(expected)
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
            it('deletes the customer', async () => {
                await fixture.httpClient
                    .delete(`/customers/${fixture.createdCustomer.id}`)
                    .ok({ deletedCustomers: [fixture.createdCustomer] })

                await fixture.httpClient.get(`/customers/${fixture.createdCustomer.id}`).notFound()
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

        describe('when the query parameters are missing', () => {
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

        describe('when the query parameters are invalid', () => {
            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .get('/customers')
                    .query({ wrong: 'value' })
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })

        describe('when a partial `name` is provided', () => {
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

        describe('when a partial `email` is provided', () => {
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
