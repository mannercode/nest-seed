import type { OnModuleInit } from '@nestjs/common'
import type { HydratedDocument, Model } from 'mongoose'

// append-only 모델의 컬렉션 초기화와 문서 생성만 공통화하며 조회 API는 하위 클래스가 정한다.
export abstract class AppendOnlyRepository<Doc> implements OnModuleInit {
    constructor(protected readonly model: Model<Doc>) {}

    async onModuleInit() {
        // 동시 첫 save의 createCollection 경합을 피하려고 미리 초기화한다.
        await this.model.createCollection()
        await this.model.createIndexes()
    }

    newDocument(): HydratedDocument<Doc> {
        return new this.model()
    }
}
