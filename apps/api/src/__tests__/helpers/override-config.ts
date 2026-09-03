import type { TestingModule } from '@nestjs/testing'
import { AppConfigService } from '#config'

export async function overrideConfigGetter<K extends 'asset' | 'ticket'>(
    module: Pick<TestingModule, 'get'>,
    key: K,
    override: Partial<AppConfigService[K]>
) {
    const config = module.get(AppConfigService)
    const original = config[key]
    const merged = { ...original, ...override }
    Object.defineProperty(config, key, { configurable: true, get: () => merged })
}
