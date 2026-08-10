import type { MongoClientOptions } from 'mongodb'

export function createMongoDriverOptions({ appName }: { appName?: string }): MongoClientOptions {
    return {
        appName,
        // replica-set 서버마다 만들어지는 풀의 운영 부하 설정이다. Jest에서는 client를 테스트 파일 안에서 재사용한다.
        minPoolSize: 50,
        maxPoolSize: 200,
        waitQueueTimeoutMS: 5000,
        writeConcern: { journal: true, w: 'majority', wtimeoutMS: 5000 }
    }
}
