import { Type } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApplicationsModule, configureApplications } from 'apps/applications'
import { configureCores, CoresModule } from 'apps/cores'
import { configureGateway, GatewayModule } from 'apps/gateway'
import { configureInfrastructures, InfrastructuresModule } from 'apps/infrastructures'
import { RedisConfigModule } from 'shared'
import {
    createHttpTestContext,
    createTestContext,
    getNatsTestConnection,
    HttpTestClient,
    HttpTestContext,
    ModuleMetadataEx,
    TestContext
} from 'testlib'
import { AllProviders, getAllProviders } from './all-providers'

const createConfigServiceMock = (mockValues: Record<string, any>) => {
    const realConfigService = new ConfigService()

    return {
        original: ConfigService,
        replacement: {
            get: jest.fn((key: string) =>
                key in mockValues ? mockValues[key] : realConfigService.get(key)
            )
        }
    }
}

type TestContextOpts = ModuleMetadataEx & { config?: Record<string, any> }

const createMetadata = (module: Type<any>, metadata: TestContextOpts = {}): ModuleMetadataEx => {
    const { ignoreGuards, ignoreProviders, overrideProviders, config } = metadata
    const configMock = createConfigServiceMock({ ...config })

    return {
        imports: [module],
        ignoreProviders,
        ignoreGuards,
        overrideProviders: [configMock, ...(overrideProviders ?? [])]
    }
}

export interface CommonFixture extends AllProviders {
    gatewayContext: HttpTestContext
    appsContext: TestContext
    coresContext: TestContext
    infrasContext: TestContext
    httpClient: HttpTestClient
    close: () => Promise<void>
}

type CreateCommonFixtureOptions = {
    gateway?: TestContextOpts
    apps?: TestContextOpts
    cores?: TestContextOpts
    infras?: TestContextOpts
}

export const createCommonFixture = async ({
    gateway,
    apps,
    cores,
    infras
}: CreateCommonFixtureOptions = {}): Promise<CommonFixture> => {
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

    const gatewayContext = await createHttpTestContext({
        metadata: createMetadata(GatewayModule, gateway),
        brokers,
        configureApp: configureGateway
    })

    const providers = await getAllProviders(
        gatewayContext,
        appsContext,
        coresContext,
        infrasContext
    )

    const httpClient = gatewayContext.httpClient

    const close = async () => {
        await gatewayContext.close()

        await appsContext.close()
        const appsRedis = appsContext.module.get(RedisConfigModule.moduleName)
        await appsRedis.quit()

        await coresContext.close()
        const coresRedis = coresContext.module.get(RedisConfigModule.moduleName)
        await coresRedis.quit()

        await infrasContext.close()
    }

    return {
        ...providers,
        gatewayContext,
        appsContext,
        coresContext,
        infrasContext,
        httpClient,
        close
    }
}
