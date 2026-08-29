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
        // 유지하고, 파일 수명의 Vitest client는 실제 요청이 있을 때만 연결을 만든다.
        minPoolSize: lifetime === 'application' ? 50 : 0,
        maxPoolSize: 200,
        // 프로세스 수명의 앱은 과부하를 5초 안에 드러낸다. Vitest 파일 수명의 client는
        // hook 자체의 timeout이 전체 작업을 제한하므로 driver queue에 더 짧은 중복
        // deadline을 두지 않는다. CPU가 붐빌 때 정상 checkout이 먼저 만료되는 일을 막는다.
        waitQueueTimeoutMS: lifetime === 'application' ? 5000 : 0,
        writeConcern: { journal: true, w: 'majority', wtimeoutMS: 5000 }
    }
}
