import type { OnModuleInit } from '@nestjs/common'
import type { HydratedDocument, Model } from 'mongoose'

/**
 * 추가만 일어나는 도메인용 리포지토리 기반 클래스이다.
 * 노출 면을 일부러 작게 제한했다.
 * 이 도메인의 모든 사용자가 공통으로 필요한 책임은 두 가지뿐이라 그렇다.
 *
 * - 컬렉션 라이프사이클(`createCollection` / `createIndexes`의 동시 호출
 *   경합을 막는 일).
 * - `newDocument` 헬퍼.
 *
 * 도메인별 추가·조회 메서드는 하위 클래스가 직접 정의한다.
 * 모델마다 필드와 검증, 조회 패턴이 달라서, 공통 조회 API를 미리 고정하는 것은 이른 추상화이다.
 * 두 번째 append-only 모델이 들어오면 그때 두 사례를 비교해 공통을 기반에 올린다.
 *
 * 수정·삭제는 스키마 단계(`createAppendOnlySchema`)에서 throw로 막힌다.
 * 그래서 이 리포지토리 타입에도 그 메서드들이 자연스럽게 노출되지 않는다.
 */
export abstract class AppendOnlyRepository<Doc> implements OnModuleInit {
    constructor(protected readonly model: Model<Doc>) {}

    async onModuleInit() {
        // `document.save()`가 내부에서 `createCollection()`을 부른다.
        // 같은 시점에 `save()`가 여러 곳에서 동시에 호출되면 Mongo가 같은 컬렉션을 동시에 만들려 들면서 "Collection namespace is already in use" 에러를 낸다.
        // 단위 테스트처럼 빠르게 초기화를 반복하는 환경에서 자주 보이는 증상이다.
        // 모듈 초기화 시점에 미리 만들어 두면 경합이 사라진다.
        await this.model.createCollection()
        await this.model.createIndexes()
    }

    newDocument(): HydratedDocument<Doc> {
        return new this.model()
    }
}
