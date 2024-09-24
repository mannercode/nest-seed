import { Type } from '@nestjs/common'
import { Schema, SchemaFactory } from '@nestjs/mongoose'
import { Types } from 'mongoose'

export class ObjectId extends Types.ObjectId {}
export type DocumentId = ObjectId | string
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
    collation: { locale: 'en_US', strength: 1 }
})
export class MongooseSchema {
    id: DocumentId
    createdAt: Date
    updatedAt: Date
    __v: number
}

export type SchemeBody<T> = Omit<T, keyof MongooseSchema>

const BaseSchemaClass = SchemaFactory.createForClass(MongooseSchema)

export function createMongooseSchema<T extends Type<MongooseSchema>>(cls: T) {
    const schema = SchemaFactory.createForClass(cls)
    schema.add(BaseSchemaClass)

    return schema
}
