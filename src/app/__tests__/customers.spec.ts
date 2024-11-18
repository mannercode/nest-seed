import { expect } from '@jest/globals'
import { nullObjectId } from 'common'
import { CustomerDto } from 'services/customers'
import { expectEqualUnsorted, HttpTestClient } from 'testlib'
import {
    closeIsolatedFixture,
    createCustomer,
    createCustomers,
    createIsolatedFixture,
    IsolatedFixture,
    createCustomerDto
} from './customers.fixture'

describe('Customers Module', () => {
    let isolated: IsolatedFixture
    let client: HttpTestClient

    beforeEach(async () => {
        isolated = await createIsolatedFixture()
        client = isolated.testContext.client
    })

    afterEach(async () => {
        await closeIsolatedFixture(isolated)
    })

    describe('POST /customers', () => {
        it('고객을 생성해야 한다', async () => {
            const { createDto, expectedDto } = createCustomerDto()

            await client.post('/customers').body(createDto).created(expectedDto)
        })

        it('이메일이 이미 존재하면 CONFLICT(409)를 반환해야 한다', async () => {
            const { createDto } = createCustomerDto()

            await client.post('/customers').body(createDto).created()
            await client
                .post('/customers')
                .body(createDto)
                .conflict({
                    error: 'Conflict',
                    message: `Customer with email ${createDto.email} already exists`,
                    statusCode: 409
                })
        })

        it('필수 필드가 누락되면 BAD_REQUEST(400)를 반환해야 한다', async () => {
            await client
                .post('/customers')
                .body({})
                .badRequest({
                    error: 'Bad Request',
                    message: [
                        'name should not be empty',
                        'name must be a string',
                        'email must be an email',
                        'birthdate must be a Date instance',
                        'password must be a string'
                    ],
                    statusCode: 400
                })
        })
    })

    describe('PATCH /customers/:id', () => {
        let customer: CustomerDto

        beforeEach(async () => {
            customer = await createCustomer(client)
        })

        it('고객 정보를 업데이트해야 한다', async () => {
            const updateDto = {
                name: '업데이트된 이름',
                email: 'new@mail.com',
                birthdate: new Date('1900-12-31')
            }
            const expected = { ...customer, ...updateDto }

            await client.patch(`/customers/${customer.id}`).body(updateDto).ok(expected)
            await client.get(`/customers/${customer.id}`).ok(expected)
        })

        it('고객이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
            await client.patch(`/customers/${nullObjectId}`).body({}).notFound({
                error: 'Not Found',
                message: 'Customer with ID 000000000000000000000000 not found',
                statusCode: 404
            })
        })
    })

    describe('DELETE /customers/:id', () => {
        let customer: CustomerDto

        beforeEach(async () => {
            customer = await createCustomer(client)
        })

        it('고객을 삭제해야 한다', async () => {
            await client.delete(`/customers/${customer.id}`).ok()
            await client.get(`/customers/${customer.id}`).notFound({
                error: 'Not Found',
                message: `Customer with ID ${customer.id} not found`,
                statusCode: 404
            })
        })

        it('고객이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
            await client.delete(`/customers/${nullObjectId}`).notFound({
                error: 'Not Found',
                message: 'Customer with ID 000000000000000000000000 not found',
                statusCode: 404
            })
        })
    })

    describe('GET /customers/:id', () => {
        let customer: CustomerDto

        beforeEach(async () => {
            customer = await createCustomer(client)
        })

        it('고객 정보를 가져와야 한다', async () => {
            await client.get(`/customers/${customer.id}`).ok(customer)
        })

        it('고객이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
            await client.get(`/customers/${nullObjectId}`).notFound({
                error: 'Not Found',
                message: 'Customer with ID 000000000000000000000000 not found',
                statusCode: 404
            })
        })
    })

    describe('GET /customers', () => {
        let customers: CustomerDto[]

        beforeEach(async () => {
            customers = await createCustomers(client)
        })

        it('기본 페이지네이션 설정으로 고객을 가져와야 한다', async () => {
            const { body } = await client.get('/customers').ok()
            const { items, ...paginated } = body

            expect(paginated).toEqual({
                skip: 0,
                take: expect.any(Number),
                total: customers.length
            })
            expectEqualUnsorted(items, customers)
        })

        it('잘못된 필드로 검색하면 BAD_REQUEST(400)를 반환해야 한다', async () => {
            await client
                .get('/customers')
                .query({ wrong: 'value' })
                .badRequest({
                    error: 'Bad Request',
                    message: ['property wrong should not exist'],
                    statusCode: 400
                })
        })

        it('이름의 일부로 고객을 검색할 수 있어야 한다', async () => {
            const partialName = 'Customer-1'
            const { body } = await client.get('/customers').query({ name: partialName }).ok()

            const expected = customers.filter((customer) => customer.name.startsWith(partialName))
            expectEqualUnsorted(body.items, expected)
        })

        it('이메일의 일부로 고객을 검색할 수 있어야 한다', async () => {
            const partialEmail = 'user-1'
            const { body } = await client.get('/customers').query({ email: partialEmail }).ok()

            const expected = customers.filter((customer) => customer.email.startsWith(partialEmail))
            expectEqualUnsorted(body.items, expected)
        })
    })
})
