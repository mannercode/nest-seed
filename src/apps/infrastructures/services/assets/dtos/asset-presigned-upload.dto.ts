export class AssetPresignedUploadDto {
    assetId: string
    method: 'PUT'
    headers: Record<string, string>
    url: string
    expiresAt: Date
}
