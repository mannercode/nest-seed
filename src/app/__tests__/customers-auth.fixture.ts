import { AppConfigService } from 'config'
import { omit } from 'lodash'
import { createHttpTestContext, HttpTestClient, HttpTestContext } from 'testlib'
import { AppModule, configureApp } from '../app.module'


export interface IsolatedFixture {
    testContext: HttpTestContext
    config: AppConfigService
    credentials: Credentials
}

export async function createIsolatedFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)
    const config = testContext.app.get(AppConfigService)
    const credentials = await createCredentials(testContext.client)

    return { testContext, config, credentials }
}

export async function closeIsolatedFixture(fixture: IsolatedFixture) {
    await fixture.testContext.close()
}

export const createCustomerDto = (overrides = {}) => {
    const createDto = {
        name: 'name',
        email: 'name@mail.com',
        birthdate: new Date('2020-12-12'),
        password: 'password',
        ...overrides
    }

    const expectedDto = { id: expect.anything(), ...omit(createDto, 'password') }

    return { createDto, expectedDto }
}

export const createCustomer = async (client: HttpTestClient, override = {}) => {
    const { createDto } = createCustomerDto(override)
    const { body } = await client.post('/customers').body(createDto).created()
    return body
}

export interface Credentials {
    customerId: string
    email: string
    password: string
}

export async function createCredentials(client: HttpTestClient): Promise<Credentials> {
    const createDto = {
        email: 'user@mail.com',
        password: 'password'
    }

    const customer = await createCustomer(client, createDto)

    return {
        customerId: customer.id,
        email: createDto.email,
        password: createDto.password
    }
}
