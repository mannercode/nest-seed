import type { ConfigService } from '@nestjs/config'
import { AppConfigService } from '../index.js'

describe('AppConfigService.schema', () => {
    const portSchema = AppConfigService.schema.pick({ API_PORT: true })

    it('환경 변수 숫자 문자열을 숫자로 변환한다', () => {
        expect(portSchema.parse({ API_PORT: '3000' })).toEqual({ API_PORT: 3000 })
    })

    it('이미 숫자인 설정값도 허용한다', () => {
        expect(portSchema.parse({ API_PORT: 3000 })).toEqual({ API_PORT: 3000 })
    })

    it.each([
        { condition: '빈 문자열이면', value: '' },
        { condition: '16진수 문자열이면', value: '0x10' }
    ])('포트 값이 $condition 검증에 실패한다', ({ value }) => {
        expect(portSchema.safeParse({ API_PORT: value }).success).toBe(false)
    })

    it('누락된 환경 변수를 기본값으로 채우지 않는다', () => {
        const schema = AppConfigService.schema.pick({ TICKET_PRICE: true })

        expect(schema.safeParse({}).success).toBe(false)
    })

    describe('S3_FORCE_PATH_STYLE', () => {
        const schema = AppConfigService.schema.pick({ S3_FORCE_PATH_STYLE: true })

        it.each([
            { condition: '소문자 false이면', value: 'false' },
            { condition: '공백을 포함한 대문자 FALSE이면', value: ' FALSE ' }
        ])('$condition false로 변환한다', ({ value }) => {
            expect(schema.parse({ S3_FORCE_PATH_STYLE: value })).toEqual({
                S3_FORCE_PATH_STYLE: false
            })
        })

        it('true·false가 아닌 문자열은 거절한다', () => {
            expect(schema.safeParse({ S3_FORCE_PATH_STYLE: 'yes' }).success).toBe(false)
        })
    })
})

describe('AppConfigService.mongo', () => {
    let config: AppConfigService

    beforeEach(() => {
        const values = { MONGO_DATABASE: 'test-database', MONGO_URI: 'mongodb://mongo.test' }
        const configService = { get: (key: keyof typeof values) => values[key] } as ConfigService

        config = new AppConfigService(configService, 'test-project')
    })

    it('MongoDB 접속 주소와 데이터베이스 이름을 반환한다', () => {
        expect(config.mongo).toEqual({ dbName: 'test-database', uri: 'mongodb://mongo.test' })
    })
})
