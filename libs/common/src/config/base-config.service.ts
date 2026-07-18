import type { ConfigService } from '@nestjs/config'

// ConfigService가 환경 변수 문자열을 그대로 돌려주는 경우에도 요청한 원시 타입을 보장한다.
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

        // Number('')는 0이라 빈 문자열이 조용히 0으로 통과한다. 명시적으로 거절한다.
        if (typeof value === 'string' && value.trim().length === 0) {
            throw new Error(`Key '${key}' is not a finite number: '${value}'`)
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
