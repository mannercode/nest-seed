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
    configureApp?: (app: INestApplication<Server>) => Promise<void>
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
    ...metadata
}: ModuleMetadataEx): Promise<TestContext> {
    ignoreProviders?.forEach((provider) => {
        metadata.providers?.push({ provide: provider, useClass: NullProvider })
    })

    const builder = Test.createTestingModule(metadata)

    ignoreGuards?.forEach((guard) => {
        builder.overrideGuard(guard).useClass(NullGuard)
    })

    overrideProviders?.forEach(({ original, replacement }) => {
        builder.overrideProvider(original).useValue(replacement)
    })

    const module = await builder.compile()

    const app = module.createNestApplication()

    if (configureApp) {
        await configureApp(app)
    }

    app.useLogger(isDebuggingEnabled ? console : false)

    await app.init()

    const close = async () => {
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
