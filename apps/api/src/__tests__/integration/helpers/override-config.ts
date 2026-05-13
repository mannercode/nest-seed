import type { TestingModule } from '@nestjs/testing'
import type { AppConfigService } from 'config'

/**
 * `AppConfigService`의 묶음 설정 중 일부만 덮어씁니다. 통합 테스트에서
 * `.env` 정책 값(예: `ticket.holdDurationInMs`)을 짧은 보관 시간으로 잠시
 * 바꿔야 할 때 사용합니다.
 *
 * `AppConfigService`는 동적으로 가져옵니다. Jest의 `resetModules: true` 환경에서는
 * 픽스처가 동적 가져오기로 새 모듈 실행 영역을 만듭니다. 이 헬퍼가 정적 가져오기를 쓰면
 * 클래스가 서로 다른 값으로 인식되어 `module.get`이 같은 제공자를 찾지 못합니다.
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
