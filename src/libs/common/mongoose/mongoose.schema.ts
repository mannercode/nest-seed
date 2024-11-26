import { FlattenMaps, HydratedDocument, SchemaOptions, Types } from 'mongoose'

// TODO optimisticConcurrency 테스트로 만들어라
export const defaultSchemaOption = {
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
        flattenObjectIds: true,
        versionKey: false,
        transform: function (_doc, ret) {
            delete ret._id
            delete ret.deleted
            delete ret.createdAt
            delete ret.updatedAt
        }
    }
} as SchemaOptions

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

export class MongooseSchema {
    id: string
    createdAt: Date
    updatedAt: Date
    __v: number
}

type ReplaceObjectIdWithString<T> = {
    [K in keyof T]: T[K] extends Types.ObjectId ? string : T[K]
}

export type SchemaJson<T> = FlattenMaps<ReplaceObjectIdWithString<T>>

export function toDto2<S, T>(item: HydratedDocument<S>) {
    return item.toJSON<T>()
}

export function toDtos2<S, T>(items: HydratedDocument<S>[]) {
    return items.map((item) => item.toJSON<T>())
}


// // export enum MovieGenre {
// //     Action = 'Action',
// //     Comedy = 'Comedy'
// // }

// @Schema(defaultSchemaOption)
// export class Sample extends MongooseSchema {
//     @Prop({ required: true })
//     name: string

//     // @Prop({ required: true })
//     // objId: Types.ObjectId

//     // @Prop({ type: Map, of: String })
//     // attributes: Map<string, string>

//     // @Prop({ required: true })
//     // releaseDate: Date

//     // @Prop({ type: [String], enum: MovieGenre, default: [] })
//     // genre: MovieGenre[]
// }
