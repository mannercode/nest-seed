import { ConfigService } from '@nestjs/config'
import { CustomerJwtAuthGuard } from 'gateway/controllers'
import { getProxyValue } from 'common'
import { GatewayModule } from 'gateway/gateway.module'
import { configureGateway } from 'gateway/main'
import { omit } from 'lodash'
import { configureServices } from 'services/main'
import { ServicesModule } from 'services/services.module'
import {
    HttpTestContext,
    MicroserviceTestContext,
    createHttpTestContext,
    createMicroserviceTestContext
} from 'testlib'
import { CustomersService } from 'services/cores'

export interface Fixture {
    httpContext: HttpTestContext
    msContext: MicroserviceTestContext
    customersService: CustomersService
}

export async function createFixture() {
    const msContext = await createMicroserviceTestContext(
        { imports: [ServicesModule] },
        configureServices
    )

    const realConfigService = new ConfigService()

    const mockConfigService = {
        get: jest.fn((key: string) => {
            const mockValues: Record<string, any> = {
                SERVICE_PORT: msContext.port
            }

            if (key in mockValues) {
                return mockValues[key]
            }

            return realConfigService.get(key)
        })
    }

    const httpContext = await createHttpTestContext(
        {
            imports: [GatewayModule],
            overrideProviders: [{ original: ConfigService, replacement: mockConfigService }],
            ignoreGuards: [CustomerJwtAuthGuard]
        },
        configureGateway
    )

    const customersService = msContext.module.get(CustomersService)

    return { httpContext, customersService, msContext }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.httpContext.close()
    await fixture.msContext.close()
}

export const createCustomerDto = (overrides = {}) => {
    const createDto = {
        name: 'name',
        email: 'name@mail.com',
        birthdate: new Date('2020-12-12'),
        password: 'password',
        ...overrides
    }

    const expectedDto = { id: expect.any(String), ...omit(createDto, 'password') }

    return { createDto, expectedDto }
}

export const createCustomer = async (customersService: CustomersService, override = {}) => {
    const { createDto } = createCustomerDto(override)
    const customer = await customersService.createCustomer(createDto)
    return customer
}

export const createCustomers = async (
    customersService: CustomersService,
    length: number = 20,
    overrides = {}
) => {
    return Promise.all(
        Array.from({ length }, async (_, index) =>
            createCustomer(customersService, {
                name: `Customer-${index}`,
                email: `user-${index}@mail.com`,
                ...overrides
            })
        )
    )
}
