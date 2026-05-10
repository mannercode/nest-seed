import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'

@Module({
    imports: [
        MongooseModule.forRootAsync({
            connectionName: MONGO_CONNECTION_NAME,
            inject: [AppConfigService],
            useFactory: async (config: AppConfigService) => {
                const { uri, dbName } = config.mongo

                return {
                    autoCreate: true,
                    autoIndex: true,
                    bufferCommands: true,
                    dbName,
                    // cycle-04 의 (10, 50) 이 Test Stability race 시나리오에서
                    // MongoWaitQueueTimeoutError 를 일으켜 (50, 200) 으로 되돌림.
                    // race 테스트는 4 replica 에 500 동시 POST (=125/replica) 를
                    // 쏘는데, maxPool=50 이 넘쳐서 waitQueueTimeoutMS=5s 까지
                    // queue 가 밀렸다. cycle-04 의 perf sweep 은 theater
                    // read/write c=400 까지만 커버해서 이 burst 영역을 놓쳤다.
                    minPoolSize: 50,
                    maxPoolSize: 200,
                    uri,
                    waitQueueTimeoutMS: 5000,
                    writeConcern: { journal: true, w: 'majority', wtimeoutMS: 5000 }
                }
            }
        })
    ]
})
export class MongooseSetupModule {}
