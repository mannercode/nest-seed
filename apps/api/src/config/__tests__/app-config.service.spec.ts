import { ConfigService } from '@nestjs/config'
import { AppConfigService } from '#config'

describe('AppConfigService.schema', () => {
    const portSchema = AppConfigService.schema.pick({ API_PORT: true })

    describe('API_PORT가 숫자 문자열이면', () => {
        let input: unknown
        beforeEach(() => {
            input = { API_PORT: '3000' }
        })
        it('숫자로 변환한다', () => {
            expect(portSchema.parse(input)).toEqual({ API_PORT: 3000 })
        })
    })

    describe('API_PORT가 숫자이면', () => {
        let input: unknown
        beforeEach(() => {
            input = { API_PORT: 3000 }
        })
        it('값을 그대로 반환한다', () => {
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
        it('검증에 실패한다', () => {
            expect(portSchema.safeParse(input).success).toBe(false)
        })
    })

    describe('HTTP_REQUEST_PAYLOAD_LIMIT', () => {
        const schema = AppConfigService.schema.shape.HTTP_REQUEST_PAYLOAD_LIMIT

        it.each(['1.5mb', '1572864'])('%s를 그대로 전달한다', (limit) => {
            expect(schema.parse(limit)).toBe(limit)
        })

        it('값이 비어 있으면 검증에 실패한다', () => {
            expect(schema.safeParse('').success).toBe(false)
        })
    })

    describe('필수 환경 변수 ASSET_UPLOAD_EXPIRES_SEC가 없으면', () => {
        let input: Record<string, unknown>
        beforeEach(() => {
            input = {}
        })
        it('검증에 실패한다', () => {
            const schema = AppConfigService.schema.pick({ ASSET_UPLOAD_EXPIRES_SEC: true })

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
            it('false로 변환한다', () => {
                expect(schema.parse(input)).toEqual({ S3_FORCE_PATH_STYLE: false })
            })
        })

        describe('값이 true·false가 아닌 문자열이면', () => {
            let input: unknown
            beforeEach(() => {
                input = { S3_FORCE_PATH_STYLE: 'yes' }
            })
            it('검증에 실패한다', () => {
                expect(schema.safeParse(input).success).toBe(false)
            })
        })
    })

    const deploymentSchema = AppConfigService.schema.pick({ RESTATE_DEPLOYMENT_URI: true })
    describe.each([
        { condition: '없으면', uri: undefined },
        { condition: 'HTTP 주소가 아니면', uri: 'ftp://worker:9080' }
    ])('RESTATE_DEPLOYMENT_URI가 $condition', ({ uri }) => {
        it('오류 메시지에 변수 이름을 포함한다', () => {
            expect(() => deploymentSchema.parse({ RESTATE_DEPLOYMENT_URI: uri })).toThrow(
                'RESTATE_DEPLOYMENT_URI'
            )
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

describe('AppConfigService.log', () => {
    describe('주입된 프로젝트 ID와 원시 환경 값이 다르면', () => {
        const config = new AppConfigService(
            new ConfigService({ PROJECT_ID: 'raw', NODE_ENV: 'test', LOG_CONSOLE_LEVEL: 'silent' }),
            'injected'
        )
        it('로그 서비스 이름으로 주입된 프로젝트 ID를 반환한다', () => {
            expect(config.log.serviceName).toBe('injected')
        })
    })
})
