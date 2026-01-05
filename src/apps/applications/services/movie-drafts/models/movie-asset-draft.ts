import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'

export enum MovieAssetDraftStatus {
    Pending = 'pending',
    Ready = 'ready'
}

@Schema({ _id: false })
export class MovieAssetDraft {
    @Prop({ required: true })
    assetId: string

    @Prop({ required: true, type: String, enum: MovieAssetDraftStatus })
    status: MovieAssetDraftStatus
}

export const MovieAssetDraftSchema = SchemaFactory.createForClass(MovieAssetDraft)
