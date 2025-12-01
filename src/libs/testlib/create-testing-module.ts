import { CanActivate, ExecutionContext, Injectable, ModuleMetadata, Type } from '@nestjs/common'
import { Test } from '@nestjs/testing'

export type ModuleMetadataEx = ModuleMetadata & {
    ignoreGuards?: Type<CanActivate>[]
    ignoreProviders?: Type<any>[]
    overrideProviders?: { original: Type<any>; replacement: any }[]
}

class NullGuard implements CanActivate {
    canActivate(_context: ExecutionContext): boolean {
        return true
    }
}

@Injectable()
class NullProvider {}

export async function createTestingModule(metadataEx: ModuleMetadataEx) {
    const { ignoreGuards, ignoreProviders, overrideProviders, ...metadata } = metadataEx
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
    return module
}
