import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'

@Module({
    imports: [
        MongooseModule.forRootAsync({
            connectionName: MONGO_CONNECTION_NAME,
            inject: [AppConfigService],
            useFactory: async (config: AppConfigService) => {
                const { database, host1, host2, host3, password, replicaSet, user } = config.mongo

                // userinfo 는 RFC 3986 에 따라 URL-encode 한다. 비번에 `@`/`:`/`/` 가 들어가면
                // 인코딩 없이는 URI 파서가 잘못 끊는다. host 부분은 이미 hostname:port 형식이므로
                // 인코딩 대상 아님.
                const encodedUser = encodeURIComponent(user)
                const encodedPassword = encodeURIComponent(password)

                return {
                    autoCreate: true,
                    autoIndex: true,
                    bufferCommands: true,
                    dbName: database,
                    // cycle-04 의 (10, 50) 이 Test Stability race 시나리오에서
                    // MongoWaitQueueTimeoutError 를 일으켜 (50, 200) 으로 되돌림.
                    // race 테스트는 4 replica 에 500 동시 POST (=125/replica) 를
                    // 쏘는데, maxPool=50 이 넘쳐서 waitQueueTimeoutMS=5s 까지
                    // queue 가 밀렸다. cycle-04 의 perf sweep 은 theater
                    // read/write c=400 까지만 커버해서 이 burst 영역을 놓쳤다.
                    minPoolSize: 50,
                    maxPoolSize: 200,
                    uri: `mongodb://${encodedUser}:${encodedPassword}@${host1},${host2},${host3}/?replicaSet=${replicaSet}`,
                    waitQueueTimeoutMS: 5000,
                    writeConcern: { journal: true, w: 'majority', wtimeoutMS: 5000 }
                }
            }
        })
    ]
})
export class MongooseSetupModule {}
