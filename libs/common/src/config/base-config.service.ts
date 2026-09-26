import { InternalServerErrorException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'

// ConfigService가 돌려주는 환경 변수 문자열은 boolean/number getter에서 변환하고 검증한다.
export abstract class BaseConfigService {
    constructor(private readonly configService: ConfigService) {}

    getBoolean(key: string): boolean {
        const value = this.configService.get<unknown>(key)

        if (value === undefined) {
            throw new InternalServerErrorException('Internal server error', {
                cause: `Key '${key}' is not defined`
            })
        }

        if (typeof value === 'boolean') return value

        if (typeof value === 'string') {
            const lowered = value.trim().toLowerCase()
            if (lowered === 'true') return true
            if (lowered === 'false') return false
        }

        throw new InternalServerErrorException('Internal server error', {
            cause: `Key '${key}' is not a boolean: '${value}'`
        })
    }

    getNumber(key: string): number {
        const value = this.configService.get<unknown>(key)

        if (value === undefined) {
            throw new InternalServerErrorException('Internal server error', {
                cause: `Key '${key}' is not defined`
            })
        }

        // Number('')는 0이라 빈 문자열이 조용히 0으로 통과한다. 명시적으로 거절한다.
        if (
            (typeof value !== 'number' && typeof value !== 'string') ||
            (typeof value === 'string' && value.trim().length === 0)
        ) {
            throw new InternalServerErrorException('Internal server error', {
                cause: `Key '${key}' is not a finite number: '${value}'`
            })
        }

        const parsed = typeof value === 'number' ? value : Number(value)
        if (!Number.isFinite(parsed)) {
            throw new InternalServerErrorException('Internal server error', {
                cause: `Key '${key}' is not a finite number: '${value}'`
            })
        }
        return parsed
    }

    getString(key: string): string {
        const value = this.configService.get<unknown>(key)

        if (value === undefined || value === '') {
            throw new InternalServerErrorException('Internal server error', {
                cause: `Key '${key}' is not defined`
            })
        }

        if (typeof value !== 'string') {
            throw new InternalServerErrorException('Internal server error', {
                cause: `Key '${key}' is not a string`
            })
        }

        return value
    }
}
