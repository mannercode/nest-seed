import type { TestingModule } from '@nestjs/testing'
import type { AppConfigService } from 'shared'

/**
 * AppConfigService 의 그룹 getter 를 부분 override 한다.
 * 통합 테스트에서 .env 기반 정책 값(예: ticket.holdDurationInMs)을
 * 짧은 TTL 로 임시 변경할 때 사용한다.
 *
 * AppConfigService 는 동적 import 로 가져와야 한다 — jest 가 resetModules:true
 * 라 fixture 가 dynamic import 로 새 realm 을 만들면, helper 의 static import 와
 * 클래스 identity 가 달라져 module.get 이 매칭에 실패하기 때문이다.
 */
export async function overrideConfigGetter<K extends 'asset' | 'ticket'>(
    module: Pick<TestingModule, 'get'>,
    key: K,
    override: Partial<AppConfigService[K]>
) {
    const { AppConfigService } = await import('shared')
    const config = module.get(AppConfigService)
    const original = config[key]
    const merged = { ...original, ...override }
    Object.defineProperty(config, key, { configurable: true, get: () => merged })
}
