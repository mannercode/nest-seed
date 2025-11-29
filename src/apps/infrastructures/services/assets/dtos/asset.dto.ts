export class AssetDto {
    id: string
    originalName: string
    mimeType: string
    size: number
    checksum: string
    owner: { service: string; entityId: string } | null
    download: { url: string; expiresAt: Date } | null
}
