import { Type } from '@nestjs/common'
import { SchemaFactory } from '@nestjs/mongoose'
import {
    CallbackWithoutResultAndOptionalError,
    ClientSession,
    HydratedDocument,
    Types
} from 'mongoose'

/*
toObject와 toJSON의 차이는 toJSON는 flattenMaps의 기본값이 true라는 것 뿐이다.

@Schema()
export class Sample {
    @Prop({ type: Map, of: String })
    attributes: Map<string, string>
}

console.log(sample.toObject())
attributes: Map(2) { 'key1' => 'value1', 'key2' => 'value2' },

console.log(sample.toJSON())
attributes: { key1: 'value1', key2: 'value2' },
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

function excludeDeletedMiddleware(next: CallbackWithoutResultAndOptionalError) {
    if (!this.getOptions().withDeleted) {
        this.where({ deletedAt: null })
    }
    next()
}

export function createMongooseSchema<T>(cls: Type<T>) {
    const schema = SchemaFactory.createForClass(cls)

    const isHardDelete = Reflect.getMetadata(HARD_DELETE_KEY, cls) || false

    /**
     * softDelete는 다양한 상황을 테스트 하지 않았음.
     * 불완전한 기능이다.
     */
    if (isHardDelete === false) {
        schema.add({ deletedAt: { type: Date, default: null } } as any)
        schema.pre('find', excludeDeletedMiddleware)
        schema.pre('findOne', excludeDeletedMiddleware)
        schema.pre('findOneAndUpdate', excludeDeletedMiddleware)
        schema.pre('countDocuments', excludeDeletedMiddleware)
        schema.pre('aggregate', function (next) {
            this.pipeline().unshift({ $match: { deletedAt: null } })
            next()
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
            return await this.save(options)
        }
    }

    return schema
}

export type SchemaJson<T> = { [K in keyof T]: T[K] extends Types.ObjectId ? string : T[K] }
export function mapDocToDto<
    DOC extends object,
    DTO extends object,
    K extends keyof DOC & keyof DTO
>(doc: HydratedDocument<DOC>, DtoClass: new () => DTO, keys: K[]): DTO {
    const json = doc.toJSON<SchemaJson<DOC>>()
    const dto = new DtoClass()

    for (const key of keys) {
        if (json[key] !== undefined) {
            dto[key] = json[key] as DTO[K]
        }
    }
    return dto
}
