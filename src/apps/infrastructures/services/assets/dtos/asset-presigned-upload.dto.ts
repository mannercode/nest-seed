export class AssetPresignedUploadDto {
    assetId: string
    url: string
    method: 'POST'
    fields: Record<string, string>
    expiresAt: Date
}
