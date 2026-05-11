import type { Type } from '@nestjs/common'
import type { ClientSession, Query, Schema } from 'mongoose'
import { SchemaFactory } from '@nestjs/mongoose'
import { defaultTo } from '../utils'

/**
 * `toObject` 와 `toJSON` 의 차이는 `flattenMaps` 기본값뿐이다. `toJSON` 은
 * 기본이 true 라서 Map 을 평범한 객체로 풀어 준다.
 *
 * @Schema()
 * export class Sample {
 *     @Prop({ type: Map, of: String })
 *     attributes: Map<string, string>
 * }
 *
 * console.log(sample.toObject())
 * attributes: Map(2) { 'key1' => 'value1', 'key2' => 'value2' },
 *
 * console.log(sample.toJSON())
 * attributes: { key1: 'value1', key2: 'value2' },
 */

/**
 * 보통의 도메인 엔티티(생성·조회·수정·삭제 모두 가능)에 쓰는 스키마 기반
 * 클래스다. 기본 동작은 soft-delete 다. 특정 모델에서 hard-delete 가 필요하면
 * `@HardDelete()` 데코레이터를 그 모델에 붙인다.
 *
 * 감사 로그처럼 추가만 일어나는 도메인은 이 기반이 아니라 `AppendOnlySchema`
 * 와 `createAppendOnlySchema` 를 쓴다.
 */
export abstract class CrudSchema {
    createdAt: Date
    deletedAt: Date | null
    id: string
    updatedAt: Date
}

const HARD_DELETE_KEY = 'HardDelete'
export function addDeletedAtFilterToPipeline(pipeline: Record<string, any>[]) {
    const matchStage = { $match: { deletedAt: null } }
    const firstStage = pipeline[0] ?? {}

    if ('$geoNear' in firstStage || '$search' in firstStage || '$vectorSearch' in firstStage) {
        pipeline.splice(1, 0, matchStage)
        return
    }

    pipeline.unshift(matchStage)
}

export function createCrudSchema<T>(cls: Type<T>): Schema<T> {
    const schema = SchemaFactory.createForClass(cls)

    const isHardDelete = defaultTo(Reflect.getMetadata(HARD_DELETE_KEY, cls), false)
    if (isHardDelete === false) {
        schema.add({ deletedAt: { default: null, type: Date } } as any)
        // soft-delete 가 켜진 모든 조회는 `deletedAt: null` 필터를 자동으로
        // 끼우므로, 이 필드 인덱스 하나로 거의 모든 경로가 빨라진다.
        schema.index({ deletedAt: 1 })

        schema.pre('find', excludeDeletedMiddleware)
        schema.pre('findOne', excludeDeletedMiddleware)
        schema.pre('findOneAndUpdate', excludeDeletedMiddleware)
        schema.pre('findOneAndReplace', excludeDeletedMiddleware)
        schema.pre('updateOne', excludeDeletedMiddleware)
        schema.pre('updateMany', excludeDeletedMiddleware)
        schema.pre('countDocuments', excludeDeletedMiddleware)
        schema.pre('distinct', excludeDeletedMiddleware)
        schema.pre('aggregate', function () {
            addDeletedAtFilterToPipeline(this.pipeline())
        })
        schema.statics.deleteOne = async function (
            conditions,
            options?: { session?: ClientSession }
        ) {
            const updateResult = await this.updateOne(
                conditions,
                { deletedAt: new Date() },
                options
            ).exec()
            return { deletedCount: updateResult.modifiedCount }
        }
        schema.statics.deleteMany = async function (
            conditions,
            options?: { session?: ClientSession }
        ) {
            const updateResult = await this.updateMany(
                conditions,
                { deletedAt: new Date() },
                options
            ).exec()
            return { deletedCount: updateResult.modifiedCount }
        }
        schema.statics.findOneAndDelete = async function (
            conditions,
            options?: { session?: ClientSession }
        ) {
            return this.findOneAndUpdate(
                conditions,
                { deletedAt: new Date() },
                { ...options, returnDocument: 'before' }
            ).exec()
        }
        schema.methods.deleteOne = async function (options?: { session?: ClientSession }) {
            this.deletedAt = new Date()
            return this.save(options)
        }
        // `bulkWrite` 는 soft-delete 미들웨어를 거치지 않는다. 그래서 각
        // 연산의 필터에 `deletedAt: null` 을 직접 끼워 넣고, 삭제 계열
        // 연산은 update 로 바꿔서 같은 효과를 낸다.
        schema.pre('bulkWrite', function (ops) {
            for (const op of ops) {
                if ('updateOne' in op) {
                    op.updateOne.filter = { ...op.updateOne.filter, deletedAt: null }
                } else if ('updateMany' in op) {
                    op.updateMany.filter = { ...op.updateMany.filter, deletedAt: null }
                } else if ('replaceOne' in op) {
                    op.replaceOne.filter = { ...op.replaceOne.filter, deletedAt: null }
                } else if ('deleteOne' in op) {
                    const filter = op.deleteOne.filter
                    delete (op as any).deleteOne
                    ;(op as any).updateOne = {
                        filter: { ...filter, deletedAt: null },
                        update: { deletedAt: new Date() }
                    }
                } else if ('deleteMany' in op) {
                    const filter = op.deleteMany.filter
                    delete (op as any).deleteMany
                    ;(op as any).updateMany = {
                        filter: { ...filter, deletedAt: null },
                        update: { deletedAt: new Date() }
                    }
                }
            }
        })
    }

    return schema
}

export function HardDelete() {
    return (target: object) => {
        Reflect.defineMetadata(HARD_DELETE_KEY, true, target)
    }
}

function excludeDeletedMiddleware(this: Query<any, any>) {
    if (!this.getOptions().withDeleted) {
        this.where({ deletedAt: null })
    }
}
