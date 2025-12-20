import { SchemaFactory } from '@nestjs/mongoose'
import type { Type } from '@nestjs/common'
import type { ClientSession, Schema } from 'mongoose'

/**
 * The difference between toObject and toJSON is that toJSON has flattenMaps set to true by default.
 * toObject와 toJSON의 차이는 toJSON는 flattenMaps의 기본값이 true라는 것 뿐이다.
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

export abstract class MongooseSchema {
    id: string
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
}

const HARD_DELETE_KEY = 'HardDelete'
export function HardDelete() {
    return (target: object) => {
        Reflect.defineMetadata(HARD_DELETE_KEY, true, target)
    }
}

function excludeDeletedMiddleware() {
    if (!this.getOptions().withDeleted) {
        this.where({ deletedAt: null })
    }
}

export function createMongooseSchema<T>(cls: Type<T>): Schema<T> {
    const schema = SchemaFactory.createForClass(cls)

    const isHardDelete = Reflect.getMetadata(HARD_DELETE_KEY, cls) ?? false

    // The softDelete feature has not been tested under various conditions and is therefore incomplete.
    // softDelete는 다양한 상황을 테스트하지 않았다. 불완전한 기능이다.
    if (isHardDelete === false) {
        schema.add({ deletedAt: { type: Date, default: null } } as any)
        // An index is set on deletedAt because it is frequently queried in soft delete scenarios.
        // soft delete 상황에서 deletedAt이 자주 조회되므로 인덱스를 설정함
        schema.index({ deletedAt: 1 })

        schema.pre('find', excludeDeletedMiddleware)
        schema.pre('findOne', excludeDeletedMiddleware)
        schema.pre('findOneAndUpdate', excludeDeletedMiddleware)
        schema.pre('countDocuments', excludeDeletedMiddleware)
        schema.pre('aggregate', function () {
            this.pipeline().unshift({ $match: { deletedAt: null } })
        })
        schema.statics.deleteOne = async function (
            conditions,
            options?: { session?: ClientSession }
        ) {
            const ret = await this.updateOne(conditions, { deletedAt: new Date() }, options).exec()
            return { deletedCount: ret.modifiedCount }
        }
        schema.statics.deleteMany = async function (
            conditions,
            options?: { session?: ClientSession }
        ) {
            const ret = await this.updateMany(conditions, { deletedAt: new Date() }, options).exec()
            return { deletedCount: ret.modifiedCount }
        }
        schema.methods.deleteOne = async function (options?: { session?: ClientSession }) {
            this.deletedAt = new Date()
            return this.save(options)
        }
    }

    return schema
}
