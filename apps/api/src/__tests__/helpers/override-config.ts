import type { TestingModule } from '@nestjs/testing'
import type { AppConfigService } from 'config'

// resetModules 환경에서 같은 클래스 정체성을 쓰도록 AppConfigService는 동적으로 가져온다.
export async function overrideConfigGetter<K extends 'asset' | 'ticket'>(
    module: Pick<TestingModule, 'get'>,
    key: K,
    override: Partial<AppConfigService[K]>
) {
    const { AppConfigService } = await import('config')
    const config = module.get(AppConfigService)
    const original = config[key]
    const merged = { ...original, ...override }
    Object.defineProperty(config, key, { configurable: true, get: () => merged })
}
