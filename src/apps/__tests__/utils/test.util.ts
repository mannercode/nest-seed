import { getRedisConnectionToken } from '@nestjs-modules/ioredis'
import { Type } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApplicationsModule, configureApplications } from 'applications'
import { configureCores, CoresModule } from 'cores'
import { configureGateway, GatewayModule } from 'gateway'
import { configureInfrastructures, InfrastructuresModule } from 'infrastructures'
import { RedisConfig } from 'shared/config'
import {
    createTestContext,
    getNatsTestConnection,
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
    const { servers: brokers } = await getNatsTestConnection()

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

    const client = new HttpTestClient(gatewayContext.httpPort)

    const close = async () => {
        const redisToken = getRedisConnectionToken(RedisConfig.connName)

        await gatewayContext.close()
        const gatewayRedis = gatewayContext.module.get(redisToken)
        await gatewayRedis.quit()

        await appsContext.close()
        const appsRedis = appsContext.module.get(redisToken)
        await appsRedis.quit()

        await coresContext.close()
        const coresRedis = coresContext.module.get(redisToken)
        await coresRedis.quit()

        await infrasContext.close()
        const infrasRedis = infrasContext.module.get(redisToken)
        await infrasRedis.quit()
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
