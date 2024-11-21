import { Type } from '@nestjs/common'
import { Schema, SchemaFactory } from '@nestjs/mongoose'
import { Types } from 'mongoose'

export class ObjectId extends Types.ObjectId {}

export class MongooseUpdateResult {
    modifiedCount: number
    matchedCount: number
}

@Schema({
    // https://mongoosejs.com/docs/guide.html#optimisticConcurrency
    optimisticConcurrency: true,
    minimize: false,
    strict: 'throw',
    strictQuery: 'throw',
    timestamps: true,
    validateBeforeSave: true,
    // https://mongoosejs.com/docs/guide.html#collation
    collation: { locale: 'en_US', strength: 1 },
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret._id
            delete ret.deleted

            for (const key in ret) {
                if (ret[key] instanceof Types.ObjectId) {
                    ret[key] = ret[key].toString()
                }
            }
        }
    }
})
export class MongooseSchema {
    id: string
    createdAt: Date
    updatedAt: Date
    __v: number
}

export type ModelAttributes<T> = Omit<T, keyof MongooseSchema>

const BaseSchemaClass = SchemaFactory.createForClass(MongooseSchema)

export function createMongooseSchema<T extends Type<MongooseSchema>>(cls: T) {
    const schema = SchemaFactory.createForClass(cls)
    schema.add(BaseSchemaClass)

    return schema
}
