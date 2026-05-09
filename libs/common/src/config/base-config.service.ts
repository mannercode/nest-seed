import type { ConfigService } from '@nestjs/config'

/**
 * `@nestjs/config` 의 `ConfigService.get` 은 process.env 또는 validation
 * schema 가 돌려준 값을 그대로 반환한다 — schema 가 coerce 하지 않으면
 * boolean/number 를 부탁해도 string 이 돌아올 수 있다 (예: process.env 에서
 * 직접 읽힌 "true"). 이 base 는 호출자 입장에서 약속한 타입을 *항상* 보장하기
 * 위해 string 에서 boolean/number 로의 변환을 직접 수행한다. Joi 등 상위
 * validation 이 이미 coerce 했다면 그 결과를 그대로 통과시킨다.
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
