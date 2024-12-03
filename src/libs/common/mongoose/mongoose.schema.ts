import { merge } from 'lodash'
import { Type } from '@nestjs/common'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { CallbackWithoutResultAndOptionalError, FlattenMaps, SchemaOptions, Types } from 'mongoose'

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

type SchemaOptionType = {
    timestamps?: boolean
    json?: { omits?: readonly string[]; timestamps?: boolean }
}

export const createSchemaOptions = (overrides: Partial<SchemaOptionType>): SchemaOptions => {
    const defaultOptions: SchemaOptionType = {
        timestamps: true,
        json: { omits: [], timestamps: false }
    }

    const { timestamps, json } = merge({}, defaultOptions, overrides)

    return {
        // https://mongoosejs.com/docs/guide.html#optimisticConcurrency
        optimisticConcurrency: true,
        minimize: false,
        strict: 'throw',
        strictQuery: 'throw',
        timestamps,
        validateBeforeSave: true,
        // https://mongoosejs.com/docs/guide.html#collation
        collation: { locale: 'en_US', strength: 1 },
        toJSON: {
            virtuals: true,
            flattenObjectIds: true,
            versionKey: false,
            transform: function (_doc, ret) {
                delete ret._id
                delete ret.deletedAt

                if (json) {
                    const { omits, timestamps } = json

                    if (omits) {
                        omits.forEach((omit) => delete ret[omit])
                    }

                    if (!timestamps) {
                        delete ret.createdAt
                        delete ret.updatedAt
                    }
                }
            }
        }
    }
}

export class MongooseSchema {
    id: string
}

type ReplaceObjectIdWithString<T> = {
    [K in keyof T]: T[K] extends Types.ObjectId ? string : T[K]
}
type OmitKey<T, K extends keyof T = never> = FlattenMaps<ReplaceObjectIdWithString<Omit<T, K>>>
type ExtractKeys<O extends readonly any[]> = O[number]
export type SchemaJson<T, O extends readonly (keyof T)[] = []> = OmitKey<T, ExtractKeys<O>>

@Schema({})
export class SoftDeletionSchema {
    @Prop({ default: null })
    deletedAt: Date
}

function excludeDeletedMiddleware(next: CallbackWithoutResultAndOptionalError) {
    if (!this.getOptions().withDeleted) {
        this.where({ deletedAt: null })
    }
    next()
}

export type MongooseSchemaOptions = { softDeletion?: boolean }
export function createMongooseSchema<T>(cls: Type<T>, options: MongooseSchemaOptions) {
    const schema = SchemaFactory.createForClass(cls)

    const { softDeletion } = options

    if (softDeletion !== false) {
        /**
         * softDeletion는 다양한 상황을 테스트 하지 않았음.
         * 불완전한 기능이다.
         */
        const SoftDeletionSchemaClass = SchemaFactory.createForClass(SoftDeletionSchema)
        schema.add(SoftDeletionSchemaClass)
        schema.pre('find', excludeDeletedMiddleware)
        schema.pre('findOne', excludeDeletedMiddleware)
        schema.pre('findOneAndUpdate', excludeDeletedMiddleware)
        schema.pre('countDocuments', excludeDeletedMiddleware)
        schema.pre('aggregate', function (next) {
            this.pipeline().unshift({ $match: { deletedAt: null } })
            next()
        })
        schema.statics.deleteOne = async function (conditions) {
            const ret = await this.updateOne(conditions, { deletedAt: new Date() }).exec()
            return { deletedCount: ret.modifiedCount }
        }
        schema.statics.deleteMany = async function (conditions) {
            const ret = await this.updateMany(conditions, { deletedAt: new Date() }).exec()
            return { deletedCount: ret.modifiedCount }
        }
    }

    return schema
}
