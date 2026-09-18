import { Module } from '@nestjs/common'
import { MongoModule } from '@mannercode/common'
import { AppConfigService } from '#config'

@Module({
    imports: [
        MongoModule.forRootAsync({
            inject: [AppConfigService],
            // 가입 요청의 bcrypt 부하가 몰리기 전에 DB 연결을 확보한다.
            useFactory: (config: AppConfigService) => ({ ...config.mongo, minPoolSize: 50 })
        })
    ]
})
export class MongoSetupModule {}
