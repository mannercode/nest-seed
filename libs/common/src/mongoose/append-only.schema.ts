import type { Type } from '@nestjs/common'
import type { Schema } from 'mongoose'
import { SchemaFactory } from '@nestjs/mongoose'

// 변경 불가 이력용 기반이다. updatedAt/deletedAt을 두지 않고 모든 수정·삭제 경로를 막는다.
export abstract class AppendOnlySchema {
    createdAt: Date
    id: string
}

export function createAppendOnlySchema<T>(cls: Type<T>): Schema<T> {
    const schema = SchemaFactory.createForClass(cls)

    const throwMutation = function () {
        throw new Error(`${cls.name} is append-only; mutation is not allowed`)
    }
    schema.pre('updateOne', throwMutation)
    schema.pre('updateMany', throwMutation)
    schema.pre('findOneAndUpdate', throwMutation)
    schema.pre('findOneAndReplace', throwMutation)
    schema.pre('findOneAndDelete', throwMutation)
    schema.pre('replaceOne', throwMutation)
    schema.pre('deleteOne', throwMutation)
    schema.pre('deleteMany', throwMutation)
    // `Model.bulkWrite`는 쿼리 미들웨어를 거치지 않는 별도 진입점이라 모델 미들웨어로 막는다.
    schema.pre('bulkWrite', throwMutation)

    schema.pre('deleteOne', { document: true, query: false }, function () {
        throw new Error(`${cls.name} is append-only; delete is not allowed`)
    })

    // `save()`는 신규 삽입에만 허용한다. 기존 문서를 다시 저장하면 예외를 던진다.
    schema.pre('save', function () {
        if (!this.isNew) {
            throw new Error(`${cls.name} is append-only; cannot modify existing document`)
        }
    })

    return schema
}
