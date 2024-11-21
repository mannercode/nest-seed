import { AppConfigService } from 'config'
import { CustomersService } from 'services/customers'
import { createHttpTestContext, HttpTestContext } from 'testlib'
import { AppModule, configureApp } from '../app.module'
import { createCustomer } from './customers.fixture'

export interface IsolatedFixture {
    testContext: HttpTestContext
    config: AppConfigService
    credentials: Credentials
}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)
    const config = testContext.module.get(AppConfigService)
    const customersService = testContext.module.get(CustomersService)
    const credentials = await createCredentials(customersService)

    return { testContext, config, credentials }
}

export async function closeFixture(fixture: IsolatedFixture) {
    await fixture.testContext.close()
}

export interface Credentials {
    customerId: string
    email: string
    password: string
}

export async function createCredentials(customersService: CustomersService): Promise<Credentials> {
    const createDto = {
        email: 'user@mail.com',
        password: 'password'
    }

    const customer = await createCustomer(customersService, createDto)

    return {
        customerId: customer.id,
        email: createDto.email,
        password: createDto.password
    }
}
