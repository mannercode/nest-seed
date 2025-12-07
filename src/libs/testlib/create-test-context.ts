import {
    CanActivate,
    ExecutionContext,
    INestApplication,
    Injectable,
    ModuleMetadata,
    Type
} from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { Server } from 'http'
import { isDebuggingEnabled } from './utils'

export type ModuleMetadataEx = ModuleMetadata & {
    ignoreGuards?: Type<CanActivate>[]
    ignoreProviders?: Type<any>[]
    overrideProviders?: { original: Type<any>; replacement: any }[]
    brokers?: string[]
    configureApp?: (app: INestApplication<Server>, brokers: string[] | undefined) => Promise<void>
}

export type TestContext = {
    module: TestingModule
    app: INestApplication<Server>
    close: () => Promise<void>
}

export async function createTestContext({
    ignoreGuards,
    ignoreProviders,
    overrideProviders,
    configureApp,
    brokers,
    ...metadata
}: ModuleMetadataEx): Promise<TestContext> {
    const builder = Test.createTestingModule(metadata)

    ignoreGuards?.forEach((guard) => {
        builder.overrideGuard(guard).useClass(NullGuard)
    })

    ignoreProviders?.forEach((provider) => {
        builder.overrideProvider(provider).useClass(NullProvider)
    })

    overrideProviders?.forEach(({ original, replacement }) => {
        builder.overrideProvider(original).useValue(replacement)
    })

    const module = await builder.compile()

    const app = module.createNestApplication()

    if (configureApp) {
        await configureApp(app, brokers)
    }

    app.useLogger(isDebuggingEnabled ? console : false)

    await app.init()

    async function close() {
        await app.close()
    }

    return { module, app, close }
}

class NullGuard implements CanActivate {
    canActivate(_context: ExecutionContext): boolean {
        return true
    }
}

@Injectable()
class NullProvider {}
