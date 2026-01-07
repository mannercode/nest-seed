import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'

export enum MovieDraftAssetStatus {
    Pending = 'pending',
    Ready = 'ready'
}

@Schema({ _id: false })
export class MovieDraftAsset {
    @Prop({ required: true })
    assetId: string

    @Prop({ required: true, type: String, enum: MovieDraftAssetStatus })
    status: MovieDraftAssetStatus
}

export const MovieDraftAssetSchema = SchemaFactory.createForClass(MovieDraftAsset)
