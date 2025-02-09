import { Type } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApplicationsModule, configureApplications } from 'applications'
import { configureCores, CoresModule } from 'cores'
import { configureGateway, GatewayModule } from 'gateway'
import { configureInfrastructures, InfrastructuresModule } from 'infrastructures'
import {
    createHttpTestContext,
    createMicroserviceTestContext,
    createNatsContainers,
    HttpTestClient,
    HttpTestContext,
    MicroserviceTestContext,
    ModuleMetadataEx
} from 'testlib'

function createConfigServiceMock(mockValues: Record<string, any>) {
    const realConfigService = new ConfigService()

    return {
        get: jest.fn((key: string) => {
            if (key in mockValues) {
                return mockValues[key]
            }
            return realConfigService.get(key)
        })
    }
}

type TestContextOpts = ModuleMetadataEx & { config?: Record<string, any> }

async function createMicroserviceContext(
    module: Type<any>,
    servers: string[],
    configureApp: (app: any) => void,
    metadata: TestContextOpts = {},
    mockValues: Record<string, any> = {}
): Promise<MicroserviceTestContext> {
    const { ignoreGuards, ignoreProviders, overrideProviders, config } = metadata
    const mergedMockValues = { ...mockValues, ...config }
    const configMock = createConfigServiceMock(mergedMockValues)

    return createMicroserviceTestContext({
        metadata: {
            imports: [module],
            ignoreProviders,
            ignoreGuards,
            overrideProviders: [
                { original: ConfigService, replacement: configMock },
                ...(overrideProviders ?? [])
            ]
        },
        nats: { servers },
        configureApp
    })
}

async function createHttpContext(
    module: Type<any>,
    configure: (app: any) => void,
    metadata: TestContextOpts = {},
    mockValues: Record<string, any> = {}
): Promise<HttpTestContext> {
    const { ignoreGuards, ignoreProviders, overrideProviders, config } = metadata
    const mergedMockValues = { ...mockValues, ...config }
    const configMock = createConfigServiceMock(mergedMockValues)

    return createHttpTestContext(
        {
            imports: [module],
            ignoreProviders,
            ignoreGuards,
            overrideProviders: [
                { original: ConfigService, replacement: configMock },
                ...(overrideProviders ?? [])
            ]
        },
        configure
    )
}

export class TestContext {
    httpContext: HttpTestContext
    appsContext: MicroserviceTestContext
    coresContext: MicroserviceTestContext
    infrasContext: MicroserviceTestContext
    client: HttpTestClient
    close: () => Promise<void>
}

export async function createTestContext({
    http,
    apps,
    cores,
    infras
}: {
    http?: TestContextOpts
    apps?: TestContextOpts
    cores?: TestContextOpts
    infras?: TestContextOpts
} = {}): Promise<TestContext> {
    /*
    (node:803910) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 uncaughtException listeners added to [process]. MaxListeners is 10.
    Use emitter.setMaxListeners() to increase limit (Use node --trace-warnings ... to show where the warning was created)
    */
    process.setMaxListeners(20)

    const { servers, hosts, close: closeNats } = await createNatsContainers()
    process.env.NATS_HOST1 = hosts[0]
    process.env.NATS_HOST2 = hosts[1]
    process.env.NATS_HOST3 = hosts[2]

    const infrasContext = await createMicroserviceContext(
        InfrastructuresModule,
        servers,
        configureInfrastructures,
        infras
    )
    const coresContext = await createMicroserviceContext(
        CoresModule,
        servers,
        configureCores,
        cores
    )
    const appsContext = await createMicroserviceContext(
        ApplicationsModule,
        servers,
        configureApplications,
        apps
    )

    const httpContext = await createHttpContext(GatewayModule, configureGateway, http)

    const close = async () => {
        await httpContext.close()
        await appsContext.close()
        await coresContext.close()
        await infrasContext.close()
        await closeNats()
    }

    return {
        httpContext,
        appsContext,
        coresContext,
        infrasContext,
        close,
        client: httpContext.client
    }
}
