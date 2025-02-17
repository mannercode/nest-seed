import { Type } from '@nestjs/common'
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

function createMetadata(
    module: Type<any>,
    metadata: TestContextOpts = {},
    mockValues: Record<string, any> = {}
): ModuleMetadataEx {
    const { ignoreGuards, ignoreProviders, overrideProviders, config } = metadata
    const mergedMockValues = { ...mockValues, ...config }
    const configMock = createConfigServiceMock(mergedMockValues)

    return {
        imports: [module],
        ignoreProviders,
        ignoreGuards,
        overrideProviders: [
            { original: ConfigService, replacement: configMock },
            ...(overrideProviders ?? [])
        ]
    }
}

export class AllTestContexts {
    gatewayContext: TestContext
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
    const { servers: brokers, hosts, close: closeNats } = await createNatsContainers()
    process.env.NATS_HOST1 = hosts[0]
    process.env.NATS_HOST2 = hosts[1]
    process.env.NATS_HOST3 = hosts[2]

    const infrasContext = await createTestContext({
        metadata: createMetadata(InfrastructuresModule, infras),
        brokers,
        configureApp: configureInfrastructures
    })

    const coresContext = await createTestContext({
        metadata: createMetadata(CoresModule, cores),
        brokers,
        configureApp: configureCores
    })

    const appsContext = await createTestContext({
        metadata: createMetadata(ApplicationsModule, apps),
        brokers,
        configureApp: configureApplications
    })

    const gatewayContext = await createTestContext({
        metadata: createMetadata(GatewayModule, http),
        brokers,
        configureApp: configureGateway
    })

    const client = new HttpTestClient(`http://localhost:${gatewayContext.httpPort}`)

    const close = async () => {
        await gatewayContext.close()
        await appsContext.close()
        await coresContext.close()
        await infrasContext.close()
        await closeNats()
    }

    return {
        gatewayContext,
        appsContext,
        coresContext,
        infrasContext,
        close,
        client
    }
}
