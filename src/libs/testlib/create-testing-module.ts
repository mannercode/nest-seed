import { CanActivate, ExecutionContext, Injectable, ModuleMetadata } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { CacheService } from 'common'

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

export async function createTestingModule(metadata: ModuleMetadataEx) {
    const { ignoreGuards, ignoreProviders, overrideProviders, ...moduleConfig } = metadata
    const builder = Test.createTestingModule(moduleConfig)

    ignoreGuards?.forEach((guard) => builder.overrideGuard(guard).useClass(NullGuard))
    ignoreProviders?.forEach((provider) =>
        builder.overrideProvider(provider).useClass(NullProvider)
    )
    overrideProviders?.forEach((provider) =>
        builder.overrideProvider(provider.original).useValue(provider.replacement)
    )

    const module = await builder.compile()

    try {
        const cacheServices = module.get(CacheService, { each: true })
        cacheServices.map(async (service) => await service.enablePrefix())
    } catch (_error) {}

    return module
}
