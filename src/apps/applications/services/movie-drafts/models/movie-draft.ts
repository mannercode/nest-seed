import { Prop, Schema } from '@nestjs/mongoose'
import { MovieGenre, MovieRating } from 'apps/cores'
import { MongooseSchema, createMongooseSchema } from 'common'
import { HydratedDocument } from 'mongoose'
import { MongooseConfigModule } from 'shared'

export const MovieDraftImageStatus = { Pending: 'PENDING', Ready: 'READY' } as const

export type MovieDraftImage = {
    assetId: string
    status: (typeof MovieDraftImageStatus)[keyof typeof MovieDraftImageStatus]
}

@Schema(MongooseConfigModule.schemaOptions)
export class MovieDraft extends MongooseSchema {
    @Prop()
    title?: string

    @Prop({ type: [String], enum: MovieGenre, default: [] })
    genres: MovieGenre[]

    @Prop()
    releaseDate?: Date

    @Prop()
    plot?: string

    @Prop()
    durationInSeconds?: number

    @Prop()
    director?: string

    @Prop({ type: String, enum: MovieRating })
    rating?: MovieRating

    @Prop({
        type: [
            {
                assetId: { type: String, required: true },
                status: { type: String, enum: Object.values(MovieDraftImageStatus), required: true }
            }
        ],
        default: [],
        _id: false
    })
    images: MovieDraftImage[]
}

export type MovieDraftDocument = HydratedDocument<MovieDraft>
export const MovieDraftSchema = createMongooseSchema(MovieDraft)
