import type { HydratedDocument, Model } from 'mongoose'
import { OnModuleInit } from '@nestjs/common'

/**
 * Append-only category 의 repository base.
 *
 * 의도적으로 surface 가 작다 — append-only 카테고리에서 *모든* consumer 에게 공통으로
 * 필요한 책임은 두 가지뿐이다:
 * (a) 컬렉션 lifecycle (`createCollection`/`createIndexes` 동시 호출 race 회피)
 * (b) `newDocument` helper
 *
 * 도메인별 append/find 메서드는 subclass 가 직접 정의한다 — 모델마다 필드/유효성/조회
 * 패턴이 다르므로 generic read API 를 base 에 미리 박는 것은 premature abstraction 이다.
 * 두 번째 append-only 모델이 등장하면 그때 두 사례를 비교해서 공통 책임을 본 base 로
 * 끌어올린다.
 *
 * delete/update mutation 은 schema 레벨 (`createAppendOnlySchema`) 에서 throw 로 차단되므로
 * 본 repository 타입에도 자연스럽게 노출되지 않는다 (delete/update 메서드 자체가 없음).
 */
export abstract class AppendOnlyRepository<Doc> implements OnModuleInit {
    constructor(protected readonly model: Model<Doc>) {}

    async onModuleInit() {
        /**
         * document.save() 가 내부적으로 createCollection() 을 호출한다. 동시에 save() 를
         * 호출하면 "Collection namespace is already in use" 오류가 발생할 수 있다 (특히
         * 단위 테스트 환경에서 빈번한 재초기화 시).
         */
        await this.model.createCollection()
        await this.model.createIndexes()
    }

    newDocument(): HydratedDocument<Doc> {
        return new this.model()
    }
}
