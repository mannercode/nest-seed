import type { TestingModule } from '@nestjs/testing'
import type { AppConfigService } from 'config'

/**
 * `AppConfigService`의 그룹 getter를 일부만 덮어씁니다. 통합 테스트에서
 * `.env` 정책 값(예: `ticket.holdDurationInMs`)을 짧은 TTL로 잠시 바꿔야
 * 할 때 사용합니다.
 *
 * `AppConfigService`는 동적 import로 가져옵니다. Jest의 `resetModules: true`
 * 환경에서는 fixture가 동적 import로 새 module realm을 만듭니다. 이 helper가
 * 정적 import를 쓰면 클래스 identity가 달라져 `module.get`이 같은
 * provider를 찾지 못합니다.
 */
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
