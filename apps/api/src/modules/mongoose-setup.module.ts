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
                    // 부하 테스트가 복제본 4개에 동시에 요청 500건을 보내면, 복제본 한 대가 125건을 받는다.
                    // 최대 연결 수가 50이면 모자라서 일부 요청이 대기 시간 5초를 넘기고 `MongoWaitQueueTimeoutError`로 끝난다.
                    // 200으로 두면 이 구간에서 대기가 거의 발생하지 않는다.
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
