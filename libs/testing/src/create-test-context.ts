import {
    CanActivate,
    ExecutionContext,
    INestApplication,
    ModuleMetadata,
    Type
} from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import { Server } from 'http'
import { isDebuggingEnabled } from './utils'

export type ModuleMetadataEx = ModuleMetadata & {
    configureApp?: (app: INestApplication<Server>) => Promise<void>
    ignoreGuards?: Type<CanActivate>[]
    ignoreProviders?: Type<any>[]
    overrideProviders?: { original: Type<any>; replacement: any }[]
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

@Injectable()
class NullProvider {}

export async function createTestContext({
    configureApp,
    ignoreGuards,
    ignoreProviders,
    overrideProviders,
    ...metadata
}: ModuleMetadataEx): Promise<TestContext> {
    const providers = [
        ...(metadata.providers ?? []),
        ...(ignoreProviders?.map((provider) => ({ provide: provider, useClass: NullProvider })) ??
            [])
    ]

    const builder = Test.createTestingModule({ ...metadata, providers })

    ignoreGuards?.forEach((guard) => {
        builder.overrideGuard(guard).useClass(NullGuard)
    })

    overrideProviders?.forEach(({ original, replacement }) => {
        builder.overrideProvider(original).useValue(replacement)
    })

    const module = await builder.compile()

    const app = module.createNestApplication()

    app.useLogger(isDebuggingEnabled() ? console : false)

    if (configureApp) {
        await configureApp(app)
    }

    await app.init()

    const close = async () => {
        await app.close()
    }

    return { app, close, module }
}
