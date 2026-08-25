import type { MongoClientOptions } from 'mongodb'

type MongoClientLifetime = 'application' | 'test-file'

export function createMongoDriverOptions({
    appName,
    lifetime
}: {
    appName?: string
    lifetime: MongoClientLifetime
}): MongoClientOptions {
    return {
        appName,
        // minPoolSize는 replica-set의 각 서버에 적용된다. 프로세스 수명의 앱만 idle capacity를
        // 유지하고, 파일 수명의 Jest client는 실제 요청이 있을 때만 연결을 만든다.
        minPoolSize: lifetime === 'application' ? 50 : 0,
        maxPoolSize: 200,
        waitQueueTimeoutMS: 5000,
        writeConcern: { journal: true, w: 'majority', wtimeoutMS: 5000 }
    }
}
