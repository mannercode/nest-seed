import { Type } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApplicationsModule, configureApplications } from 'applications'
import { configureCores, CoresModule } from 'cores'
import { configureGateway, GatewayModule } from 'gateway'
import { configureInfrastructures, InfrastructuresModule } from 'infrastructures'
import {
    createHttpTestContext,
    createMicroserviceTestContext,
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

async function createContext<T>(
    contextCreator: (meta: ModuleMetadataEx, configureFn: (app: any) => void) => Promise<T>,
    module: Type<any>,
    configure: (app: any) => void,
    metadata: TestContextOpts = {},
    mockValues: Record<string, any> = {}
): Promise<T> {
    const { ignoreGuards, ignoreProviders, overrideProviders, config } = metadata
    const mergedMockValues = { ...mockValues, ...config }
    const configMock = createConfigServiceMock(mergedMockValues)

    return contextCreator(
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
    const infrasContext = await createContext<MicroserviceTestContext>(
        createMicroserviceTestContext,
        InfrastructuresModule,
        configureInfrastructures,
        infras
    )

    const coresContext = await createContext<MicroserviceTestContext>(
        createMicroserviceTestContext,
        CoresModule,
        configureCores,
        cores,
        { INFRASTRUCTURES_PROXY_PORT: infrasContext.port }
    )

    const appsContext = await createContext<MicroserviceTestContext>(
        createMicroserviceTestContext,
        ApplicationsModule,
        configureApplications,
        apps,
        {
            CORES_PROXY_PORT: coresContext.port,
            INFRASTRUCTURES_PROXY_PORT: infrasContext.port
        }
    )

    const httpContext = await createContext<HttpTestContext>(
        createHttpTestContext,
        GatewayModule,
        configureGateway,
        http,
        {
            APPLICATIONS_PROXY_PORT: appsContext.port,
            CORES_PROXY_PORT: coresContext.port,
            INFRASTRUCTURES_PROXY_PORT: infrasContext.port
        }
    )

    const close = async () => {
        await httpContext.close()
        await appsContext.close()
        await coresContext.close()
        await infrasContext.close()
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
