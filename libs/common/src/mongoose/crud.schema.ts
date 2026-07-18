import type { Type } from '@nestjs/common'
import type { ClientSession, Query, Schema } from 'mongoose'
import { SchemaFactory } from '@nestjs/mongoose'
import { defaultTo } from '../utils'

// 기본은 soft delete이며 완전 삭제 모델만 @HardDelete()를 붙인다.
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
        // 모든 soft-delete 조회가 자동으로 쓰는 필드다.
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
        // `bulkWrite`는 소프트 삭제 미들웨어를 거치지 않는다.
        // 그래서 각 연산의 필터에 `deletedAt: null`을 직접 추가하고, 삭제 계열 연산은 update로 바꿔서 같은 효과를 낸다.
        schema.pre('bulkWrite', function (ops) {
            for (const [i, op] of ops.entries()) {
                if ('updateOne' in op) {
                    op.updateOne.filter = { ...op.updateOne.filter, deletedAt: null }
                } else if ('updateMany' in op) {
                    op.updateMany.filter = { ...op.updateMany.filter, deletedAt: null }
                } else if ('replaceOne' in op) {
                    op.replaceOne.filter = { ...op.replaceOne.filter, deletedAt: null }
                } else if ('deleteOne' in op) {
                    // 삭제 계열은 연산 종류 자체가 바뀌므로 필터만 손대지 못하고 같은 자리를 update 연산으로 교체한다.
                    ops[i] = {
                        updateOne: {
                            filter: { ...op.deleteOne.filter, deletedAt: null },
                            update: { deletedAt: new Date() }
                        }
                    }
                } else if ('deleteMany' in op) {
                    ops[i] = {
                        updateMany: {
                            filter: { ...op.deleteMany.filter, deletedAt: null },
                            update: { deletedAt: new Date() }
                        }
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
