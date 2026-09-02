import type { ConfigService } from '@nestjs/config'
import { AppConfigService } from '../index.js'

describe('AppConfigService schema', () => {
    const portSchema = AppConfigService.schema.pick({ API_PORT: true })

    it('환경 변수 숫자 문자열을 숫자로 변환한다', () => {
        expect(portSchema.parse({ API_PORT: '3000' })).toEqual({ API_PORT: 3000 })
    })

    it('이미 숫자인 설정값도 허용한다', () => {
        expect(portSchema.parse({ API_PORT: 3000 })).toEqual({ API_PORT: 3000 })
    })

    it('빈 숫자 문자열을 0으로 변환하지 않는다', () => {
        expect(portSchema.safeParse({ API_PORT: '' }).success).toBe(false)
        expect(portSchema.safeParse({ API_PORT: '0x10' }).success).toBe(false)
    })

    it('false 문자열을 true로 잘못 변환하지 않는다', () => {
        const schema = AppConfigService.schema.pick({ S3_FORCE_PATH_STYLE: true })

        expect(schema.parse({ S3_FORCE_PATH_STYLE: 'false' })).toEqual({
            S3_FORCE_PATH_STYLE: false
        })
        expect(schema.parse({ S3_FORCE_PATH_STYLE: ' FALSE ' })).toEqual({
            S3_FORCE_PATH_STYLE: false
        })
        expect(schema.safeParse({ S3_FORCE_PATH_STYLE: 'yes' }).success).toBe(false)
    })

    it('MongoDB URI와 database 이름을 한 설정으로 반환한다', () => {
        const values = { MONGO_DATABASE: 'test-database', MONGO_URI: 'mongodb://mongo.test' }
        const configService = { get: (key: keyof typeof values) => values[key] } as ConfigService

        const config = new AppConfigService(configService, 'test-project')

        expect(config.mongo).toEqual({ dbName: 'test-database', uri: 'mongodb://mongo.test' })
    })
})
