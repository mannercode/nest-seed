import { Type } from '@nestjs/common'
import { SchemaFactory } from '@nestjs/mongoose'
import { FlattenMaps, SchemaOptions, Types } from 'mongoose'
import * as mongooseDelete from 'mongoose-delete'

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
    json?: {
        omits?: readonly string[]
        includes?: { timestamps?: boolean }
    }
}
export const createSchemaOptions = (options: SchemaOptionType): SchemaOptions => {
    const { timestamps, json } = options

    return {
        // https://mongoosejs.com/docs/guide.html#optimisticConcurrency
        optimisticConcurrency: true,
        minimize: false,
        strict: 'throw',
        strictQuery: 'throw',
        timestamps: timestamps ?? true,
        validateBeforeSave: true,
        // https://mongoosejs.com/docs/guide.html#collation
        collation: { locale: 'en_US', strength: 1 },
        toJSON: {
            virtuals: true,
            flattenObjectIds: true,
            versionKey: false,
            transform: function (_doc, ret) {
                delete ret._id
                delete ret.deleted

                let timestamps = false

                if (json) {
                    const { omits, includes } = json

                    if (omits) {
                        omits.forEach((omit) => delete ret[omit])
                    }

                    if (includes) {
                        timestamps = includes.timestamps ?? false
                    }
                }

                if (!timestamps) {
                    delete ret.createdAt
                    delete ret.updatedAt
                }
            }
        }
    }
}

export abstract class MongooseSchema {
    id: string
}

type ReplaceObjectIdWithString<T> = {
    [K in keyof T]: T[K] extends Types.ObjectId ? string : T[K]
}
type OmitKey<T, K extends keyof T = never> = FlattenMaps<ReplaceObjectIdWithString<Omit<T, K>>>
type ExtractKeys<O extends readonly any[]> = O[number]
export type SchemaJson<T, O extends readonly (keyof T)[] = []> = OmitKey<T, ExtractKeys<O>>

type MongooseSchemaOptions = { softDeletion?: boolean }
export function createMongooseSchema<T>(cls: Type<T>, options: MongooseSchemaOptions) {
    const schema = SchemaFactory.createForClass(cls)
    const { softDeletion } = options

    if (softDeletion !== false) {
        schema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' })
    }

    return schema
}
