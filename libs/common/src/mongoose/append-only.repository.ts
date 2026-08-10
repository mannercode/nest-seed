import type { OnModuleInit } from '@nestjs/common'
import type { HydratedDocument, Model } from 'mongoose'

// append-only 모델의 컬렉션 초기화와 문서 생성만 공통화하며 조회 API는 하위 클래스가 정한다.
export abstract class AppendOnlyRepository<Doc> implements OnModuleInit {
    constructor(protected readonly model: Model<Doc>) {}

    async onModuleInit() {
        // 모델 생성 때 Mongoose가 시작한 컬렉션·인덱스 초기화를 재사용해 준비만 기다린다.
        await this.model.init()
    }

    newDocument(): HydratedDocument<Doc> {
        return new this.model()
    }
}
