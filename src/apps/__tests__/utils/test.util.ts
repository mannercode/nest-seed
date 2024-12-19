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

async function createHttpContext(
    metadata: ModuleMetadataEx & { config?: Record<string, any> } = {},
    servicePort: number
) {
    const { ignoreGuards, ignoreProviders, overrideProviders, config } = metadata

    const httpContext = await createHttpTestContext(
        {
            imports: [GatewayModule],
            overrideProviders: [
                {
                    original: ConfigService,
                    replacement: createConfigServiceMock({
                        ...config,
                        SERVICE_PORT: servicePort
                    })
                },
                ...(overrideProviders ?? [])
            ],
            ignoreGuards,
            ignoreProviders
        },
        configureGateway
    )

    return httpContext
}

async function createServiceContext(
    metadata: ModuleMetadataEx & { config?: Record<string, any> } = {}
) {
    const { ignoreGuards, ignoreProviders, overrideProviders, config } = metadata

    const msContext = await createMicroserviceTestContext(
        {
            imports: [ServicesModule],
            ignoreProviders,
            ignoreGuards,
            overrideProviders: [
                {
                    original: ConfigService,
                    replacement: createConfigServiceMock({ ...config })
                },
                ...(overrideProviders ?? [])
            ]
        },
        configureServices
    )

    return msContext
}

type TestContextOpts = ModuleMetadataEx & { config?: Record<string, any> }

export async function createTestContext({
    http,
    svc
}: {
    http?: TestContextOpts
    svc?: TestContextOpts
} = {}) {
    const msContext = await createServiceContext(svc)
    const httpContext = await createHttpContext(http, msContext.port)

    const close = async () => {
        await httpContext.close()
        await msContext.close()
    }

    return { httpContext, msContext, close, module: msContext.module, client: httpContext.client }
}
