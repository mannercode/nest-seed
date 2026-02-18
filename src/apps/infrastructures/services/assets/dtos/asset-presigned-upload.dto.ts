export class AssetPresignedUploadDto {
    assetId: string
    expiresAt: Date
    fields: Record<string, string>
    method: 'POST'
    url: string
}
