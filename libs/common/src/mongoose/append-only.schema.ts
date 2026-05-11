import type { Type } from '@nestjs/common'
import type { Schema } from 'mongoose'
import { SchemaFactory } from '@nestjs/mongoose'

/**
 * 추가만 일어나는 도메인용 스키마 기반 클래스다. 감사 로그, 이벤트 로그,
 * 변경 불가 이력처럼 수정·삭제가 일어나지 않는 모델에 쓴다.
 *
 * `CrudSchema` 와 달리 `updatedAt` 과 `deletedAt` 필드가 없다. append-only
 * 에서는 의미가 없는 값이라서다. `createdAt` 만 노출한다.
 *
 * `createAppendOnlySchema` 가 스키마 단계에서 모든 수정·삭제 연산을 throw
 * 로 막는다. 모델 메서드를 직접 부르는 우회 경로까지 같이 차단된다.
 */
export abstract class AppendOnlySchema {
    createdAt: Date
    id: string
}

export function createAppendOnlySchema<T>(cls: Type<T>): Schema<T> {
    const schema = SchemaFactory.createForClass(cls)

    // 모델 메서드 호출(`model.updateOne`, `model.deleteOne` 등) 차단.
    const throwMutation = function () {
        throw new Error(`${cls.name} is append-only; mutation is not allowed`)
    }
    schema.pre('updateOne', throwMutation)
    schema.pre('updateMany', throwMutation)
    schema.pre('findOneAndUpdate', throwMutation)
    schema.pre('findOneAndReplace', throwMutation)
    schema.pre('replaceOne', throwMutation)
    schema.pre('deleteOne', throwMutation)
    schema.pre('deleteMany', throwMutation)

    // 문서 메서드 호출(`doc.deleteOne()`) 차단.
    schema.pre('deleteOne', { document: true, query: false }, function () {
        throw new Error(`${cls.name} is append-only; delete is not allowed`)
    })

    // `save()` 는 신규 삽입에만 허용한다. 기존 문서를 다시 저장하면 throw 한다.
    schema.pre('save', function () {
        if (!this.isNew) {
            throw new Error(`${cls.name} is append-only; cannot modify existing document`)
        }
    })

    return schema
}
