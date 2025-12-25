import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { MovieGenre, MovieRating } from 'apps/cores'
import { MongooseSchema, createMongooseSchema } from 'common'
import { HydratedDocument } from 'mongoose'
import { MongooseConfigModule } from 'shared'

export enum MovieDraftImageStatus {
    Pending = 'pending',
    Ready = 'ready'
}

@Schema({ _id: false })
export class MovieDraftImage {
    @Prop({ required: true })
    assetId: string

    @Prop({ required: true, type: String, enum: MovieDraftImageStatus })
    status: MovieDraftImageStatus
}
export const MovieDraftImageSchema = SchemaFactory.createForClass(MovieDraftImage)

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

    @Prop({ type: [MovieDraftImageSchema], default: [] })
    images: MovieDraftImage[]
}

export type MovieDraftDocument = HydratedDocument<MovieDraft>
export const MovieDraftSchema = createMongooseSchema(MovieDraft)
