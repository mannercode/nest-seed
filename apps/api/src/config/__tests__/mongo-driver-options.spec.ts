import { createMongoDriverOptions } from '../mongo-driver-options.js'

describe('createMongoDriverOptions', () => {
    it('프로세스 수명의 애플리케이션 풀은 운영 idle capacity를 유지한다', () => {
        const options = createMongoDriverOptions({
            appName: 'application',
            lifetime: 'application'
        })

        expect(options).toEqual({
            appName: 'application',
            maxPoolSize: 200,
            minPoolSize: 50,
            waitQueueTimeoutMS: 5000,
            writeConcern: { journal: true, w: 'majority', wtimeoutMS: 5000 }
        })
    })

    it('파일 수명의 테스트 풀은 사용하지 않는 연결을 미리 만들지 않는다', () => {
        const options = createMongoDriverOptions({ appName: 'test-file', lifetime: 'test-file' })

        expect(options).toEqual({
            appName: 'test-file',
            maxPoolSize: 200,
            minPoolSize: 0,
            waitQueueTimeoutMS: 0,
            writeConcern: { journal: true, w: 'majority', wtimeoutMS: 5000 }
        })
    })
})
