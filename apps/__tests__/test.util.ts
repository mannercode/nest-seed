import { ConfigService } from '@nestjs/config'
import { TestingModule } from '@nestjs/testing'
import { GatewayModule } from 'gateway/gateway.module'
import { configureGateway } from 'gateway/main'
import { configureServices } from 'services/main'
import { ServicesModule } from 'services/services.module'
import {
    createHttpTestContext,
    createMicroserviceTestContext,
    HttpTestClient,
    HttpTestContext,
    MicroserviceTestContext,
    ModuleMetadataEx
} from 'testlib'

export function createConfigServiceMock(mockValues: Record<string, any>) {
    const realConfigService = new ConfigService()

    const mockConfigService = {
        get: jest.fn((key: string) => {
            if (key in mockValues) {
                return mockValues[key]
            }

            return realConfigService.get(key)
        })
    }

    return mockConfigService
}

export class TestContext {
    httpContext: HttpTestContext
    msContext: MicroserviceTestContext
    module: TestingModule
    client: HttpTestClient
    close: () => Promise<void>
}

export async function createTestContext(metadata: ModuleMetadataEx = {}) {
    const { ignoreGuards, ignoreProviders, overrideProviders } = metadata

    const msContext = await createMicroserviceTestContext(
        { imports: [ServicesModule], ignoreProviders, overrideProviders },
        configureServices
    )

    const mockConfigService = createConfigServiceMock({
        SERVICE_PORT: msContext.port
    })

    const httpContext = await createHttpTestContext(
        {
            imports: [GatewayModule],
            overrideProviders: [{ original: ConfigService, replacement: mockConfigService }],
            ignoreGuards
        },
        configureGateway
    )

    const close = async () => {
        await httpContext.close()
        await msContext.close()
    }

    return { httpContext, msContext, close, module: msContext.module, client: httpContext.client }
}
