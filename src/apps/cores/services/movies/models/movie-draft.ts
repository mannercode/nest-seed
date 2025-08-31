import { Prop, Schema } from '@nestjs/mongoose'
import { createMongooseSchema } from 'common'
import { HydratedDocument } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { Movie } from './movie'

@Schema(MongooseConfigModule.schemaOptions)
export class MovieDraft extends Movie {
    @Prop({ required: true })
    expiresAt: Date
}
export type MovieDraftDocument = HydratedDocument<MovieDraft>
export const MovieDraftSchema = createMongooseSchema(MovieDraft)
