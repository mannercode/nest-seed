import { INestApplication, Type } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApplicationsModule, configureApplications } from 'applications'
import { configureCores, CoresModule } from 'cores'
import { configureGateway, GatewayModule } from 'gateway'
import { configureInfrastructures, InfrastructuresModule } from 'infrastructures'
import {
    createNatsContainers,
    createTestContext,
    HttpTestClient,
    ModuleMetadataEx,
    TestContext
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

async function createHttpContext(
    module: Type<any>,
    servers: string[],
    configureApp: (app: INestApplication<any>, servers: string[]) => Promise<void>,
    metadata: TestContextOpts = {},
    mockValues: Record<string, any> = {}
): Promise<TestContext> {
    const { ignoreGuards, ignoreProviders, overrideProviders, config } = metadata
    const mergedMockValues = { ...mockValues, ...config }
    const configMock = createConfigServiceMock(mergedMockValues)

    return createTestContext(
        {
            imports: [module],
            ignoreProviders,
            ignoreGuards,
            overrideProviders: [
                { original: ConfigService, replacement: configMock },
                ...(overrideProviders ?? [])
            ]
        },
        servers,
        configureApp
    )
}

export class AllTestContexts {
    httpContext: TestContext
    appsContext: TestContext
    coresContext: TestContext
    infrasContext: TestContext
    client: HttpTestClient
    close: () => Promise<void>
}

export async function createAllTestContexts({
    http,
    apps,
    cores,
    infras
}: {
    http?: TestContextOpts
    apps?: TestContextOpts
    cores?: TestContextOpts
    infras?: TestContextOpts
} = {}): Promise<AllTestContexts> {
    /*
    (node:803910) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 uncaughtException listeners added to [process]. MaxListeners is 10.
    Use emitter.setMaxListeners() to increase limit (Use node --trace-warnings ... to show where the warning was created)
    */
    process.setMaxListeners(20)

    const { servers, hosts, close: closeNats } = await createNatsContainers()
    process.env.NATS_HOST1 = hosts[0]
    process.env.NATS_HOST2 = hosts[1]
    process.env.NATS_HOST3 = hosts[2]

    const infrasContext = await createHttpContext(
        InfrastructuresModule,
        servers,
        configureInfrastructures,
        infras
    )
    const coresContext = await createHttpContext(CoresModule, servers, configureCores, cores)
    const appsContext = await createHttpContext(
        ApplicationsModule,
        servers,
        configureApplications,
        apps
    )

    const httpContext = await createHttpContext(GatewayModule, servers, configureGateway, http)
    const client = new HttpTestClient(`http://localhost:${httpContext.port}`)

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
        client
    }
}
