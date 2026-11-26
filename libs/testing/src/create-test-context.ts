import type {
    CanActivate,
    ExecutionContext,
    INestApplication,
    ModuleMetadata,
    Type
} from '@nestjs/common'
import type { Server } from 'http'
import { Test, type TestingModule } from '@nestjs/testing'
import { isDebuggingEnabled } from './utils.js'

export type TestModuleOptions = ModuleMetadata & {
    configureApp?: (app: INestApplication<Server>) => Promise<void>
    ignoreGuards?: Type<CanActivate>[]
    overrideProviders?: { original: string | symbol | Type; replacement: any }[]
}

export type TestContext = {
    app: INestApplication<Server>
    close: () => Promise<void>
    module: TestingModule
}

class NullGuard implements CanActivate {
    canActivate(_context: ExecutionContext): boolean {
        return true
    }
}

export async function createTestContext({
    configureApp,
    ignoreGuards,
    overrideProviders,
    ...metadata
}: TestModuleOptions): Promise<TestContext> {
    const builder = Test.createTestingModule(metadata)

    ignoreGuards?.forEach((guard) => {
        builder.overrideGuard(guard).useClass(NullGuard)
    })

    overrideProviders?.forEach(({ original, replacement }) => {
        builder.overrideProvider(original).useValue(replacement)
    })

    const module = await builder.compile()
    await using setup = new AsyncDisposableStack()
    let close = () => module.close()
    setup.defer(() => close())
    const app = module.createNestApplication()
    close = () => app.close()
    app.useLogger(isDebuggingEnabled() ? console : false)
    await configureApp?.(app)
    await app.init()
    setup.move()
    return { app, close, module }
}
