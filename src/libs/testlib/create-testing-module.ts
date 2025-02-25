import { CanActivate, ExecutionContext, Injectable, ModuleMetadata } from '@nestjs/common'
import { Test } from '@nestjs/testing'

export interface ModuleMetadataEx extends ModuleMetadata {
    ignoreGuards?: any[]
    ignoreProviders?: any[]
    overrideProviders?: { original: any; replacement: any }[]
}

class NullGuard implements CanActivate {
    canActivate(_context: ExecutionContext) {
        return true
    }
}

@Injectable()
class NullProvider {}

export async function createTestingModule(metadataEx: ModuleMetadataEx) {
    const { ignoreGuards, ignoreProviders, overrideProviders, ...metadata } = metadataEx
    const builder = Test.createTestingModule(metadata)

    ignoreGuards?.forEach((guard) => builder.overrideGuard(guard).useClass(NullGuard))
    ignoreProviders?.forEach((provider) =>
        builder.overrideProvider(provider).useClass(NullProvider)
    )
    overrideProviders?.forEach((provider) =>
        builder.overrideProvider(provider.original).useValue(provider.replacement)
    )

    const module = await builder.compile()

    return module
}
