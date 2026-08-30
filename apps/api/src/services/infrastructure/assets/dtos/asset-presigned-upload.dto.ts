export class AssetPresignedUploadDto {
    assetId: string
    expiresAt: Temporal.Instant
    fields: Record<string, string>
    method: 'POST'
    url: string
}
