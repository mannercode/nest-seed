import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'

@Schema()
export class MoviePendingAsset {
    @Prop({ required: true })
    assetId: string

    @Prop({ required: true })
    movieId: string
}

export const MoviePendingAssetSchema = SchemaFactory.createForClass(MoviePendingAsset)
