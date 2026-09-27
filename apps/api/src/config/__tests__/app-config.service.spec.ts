import type { ConfigService } from '@nestjs/config'
import { AppConfigService } from '../index.js'

describe('AppConfigService.schema', () => {
    const portSchema = AppConfigService.schema.pick({ API_PORT: true })

    describe('API_PORT가 숫자 문자열이면', () => {
        let input: unknown
        beforeEach(() => {
            input = { API_PORT: '3000' }
        })
        it('설정을 읽으면 숫자로 변환한다', () => {
            expect(portSchema.parse(input)).toEqual({ API_PORT: 3000 })
        })
    })

    describe('API_PORT가 숫자이면', () => {
        let input: unknown
        beforeEach(() => {
            input = { API_PORT: 3000 }
        })
        it('설정을 읽으면 원래 숫자를 반환한다', () => {
            expect(portSchema.parse(input)).toEqual({ API_PORT: 3000 })
        })
    })

    describe.each([
        { condition: '빈 문자열이면', value: '' },
        { condition: '16진수 문자열이면', value: '0x10' }
    ])('포트 값이 $condition', ({ value }) => {
        let input: unknown
        beforeEach(() => {
            input = { API_PORT: value }
        })
        it('설정을 검증하면 실패한다', () => {
            expect(portSchema.safeParse(input).success).toBe(false)
        })
    })

    describe('필수 환경 변수 TICKET_PRICE가 없으면', () => {
        let input: Record<string, unknown>
        beforeEach(() => {
            input = {}
        })
        it('설정을 검증하면 실패하고 기본값으로 채우지 않는다', () => {
            const schema = AppConfigService.schema.pick({ TICKET_PRICE: true })

            expect(schema.safeParse(input).success).toBe(false)
        })
    })

    describe('S3_FORCE_PATH_STYLE', () => {
        const schema = AppConfigService.schema.pick({ S3_FORCE_PATH_STYLE: true })

        describe.each([
            { condition: '소문자 false이면', value: 'false' },
            { condition: '공백을 포함한 대문자 FALSE이면', value: ' FALSE ' }
        ])('$condition', ({ value }) => {
            let input: unknown
            beforeEach(() => {
                input = { S3_FORCE_PATH_STYLE: value }
            })
            it('설정을 읽으면 false로 변환한다', () => {
                expect(schema.parse(input)).toEqual({ S3_FORCE_PATH_STYLE: false })
            })
        })

        describe('값이 true·false가 아닌 문자열이면', () => {
            let input: unknown
            beforeEach(() => {
                input = { S3_FORCE_PATH_STYLE: 'yes' }
            })
            it('설정을 검증하면 실패한다', () => {
                expect(schema.safeParse(input).success).toBe(false)
            })
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
