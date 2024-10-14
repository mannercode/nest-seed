import { omit } from 'lodash'
import { createHttpTestContext, HttpTestClient, HttpTestContext } from 'testlib'
import { AppModule } from '../app.module'

export interface IsolatedFixture {
    testContext: HttpTestContext
    credentials: Credentials
}

export async function createIsolatedFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] })
    const credentials = await createCredentials(testContext.client)

    return { testContext, credentials }
}

export async function closeIsolatedFixture(fixture: IsolatedFixture) {
    await fixture.testContext.close()
}

export const generateCustomerDto = (overrides = {}) => {
    const creationDto = {
        name: 'name',
        email: 'name@mail.com',
        birthdate: new Date('2020-12-12'),
        password: 'password',
        ...overrides
    }

    const expectedDto = { id: expect.anything(), ...omit(creationDto, 'password') }

    return { creationDto, expectedDto }
}

export const createCustomer = async (client: HttpTestClient, override = {}) => {
    const { creationDto } = generateCustomerDto(override)
    const { body } = await client.post('/customers').body(creationDto).created()
    return body
}

export interface Credentials {
    customerId: string
    email: string
    password: string
}

export async function createCredentials(client: HttpTestClient): Promise<Credentials> {
    const creationDto = {
        email: 'user@mail.com',
        password: 'password'
    }

    const customer = await createCustomer(client, creationDto)

    return {
        customerId: customer.id,
        email: creationDto.email,
        password: creationDto.password
    }
}
