import type { TestingModule } from '@nestjs/testing'
import type { AppConfigService } from 'config'

/**
 * `AppConfigService` 의 그룹 getter 를 일부만 덮어쓴다. 통합 테스트에서
 * `.env` 정책 값(예: `ticket.holdDurationInMs`)을 짧은 TTL 로 잠시 바꿔야
 * 할 때 쓴다.
 *
 * `AppConfigService` 는 동적 import 로 가져온다. Jest 의 `resetModules: true`
 * 환경에서는 fixture 가 동적 import 로 새 realm 을 만든다. 이 helper 가
 * 정적 import 를 쓰면 클래스 identity 가 달라져 `module.get` 이 같은
 * provider 를 찾지 못한다.
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
