import type { ConfigService } from '@nestjs/config'

/**
 * `@nestjs/config`의 `ConfigService.get`은 `process.env` 또는 검증 스키마가
 * 반환한 값을 그대로 넘긴다. 스키마가 형 변환을 하지 않으면, boolean이나
 * number를 요청해도 문자열이 반환될 수 있다(예: `process.env`에서 그대로
 * 읽힌 `"true"`). 이 기반 클래스는 호출자에게 약속한 타입을 항상 보장한다.
 * 문자열로 들어온 boolean이나 number는 여기서 직접 변환하고, Joi 같은 상위
 * 검증이 이미 변환했다면 그 결과를 그대로 통과시킨다.
 */
export abstract class BaseConfigService {
    constructor(private readonly configService: ConfigService) {}

    getBoolean(key: string): boolean {
        const value = this.configService.get<boolean | string>(key)

        if (value === undefined) {
            throw new Error(`Key '${key}' is not defined`)
        }

        if (typeof value === 'boolean') return value

        const lowered = String(value).trim().toLowerCase()
        if (lowered === 'true') return true
        if (lowered === 'false') return false

        throw new Error(`Key '${key}' is not a boolean: '${value}'`)
    }

    getNumber(key: string): number {
        const value = this.configService.get<number | string>(key)

        if (value === undefined) {
            throw new Error(`Key '${key}' is not defined`)
        }

        const parsed = typeof value === 'number' ? value : Number(value)
        if (!Number.isFinite(parsed)) {
            throw new Error(`Key '${key}' is not a finite number: '${value}'`)
        }
        return parsed
    }

    getString(key: string): string {
        const value = this.configService.get<string>(key)

        if (value === undefined || value.length === 0) {
            throw new Error(`Key '${key}' is not defined`)
        }

        return value
    }
}
