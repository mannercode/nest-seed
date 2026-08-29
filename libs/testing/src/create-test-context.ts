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

export type ModuleMetadataEx = ModuleMetadata & {
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
}: ModuleMetadataEx): Promise<TestContext> {
    const builder = Test.createTestingModule(metadata)

    ignoreGuards?.forEach((guard) => {
        builder.overrideGuard(guard).useClass(NullGuard)
    })

    overrideProviders?.forEach(({ original, replacement }) => {
        builder.overrideProvider(original).useValue(replacement)
    })

    const module = await builder.compile()

    const app = module.createNestApplication()

    app.useLogger(isDebuggingEnabled() ? console : false)

    try {
        if (configureApp) {
            await configureApp(app)
        }

        await app.init()
    } catch (setupError) {
        try {
            await app.close()
        } catch {
            // 설정 오류가 정리 오류에 가려지지 않게 원래 오류를 유지한다.
        }

        throw setupError
    }

    const close = async () => {
        await app.close()
    }

    return { app, close, module }
}
