export class AttachmentDto {
    id: string
    originalName: string
    mimeType: string
    size: number
    checksum: string
    ownerService: string | null
    ownerEntityId: string | null
    downloadUrl?: string
    downloadUrlExpiresAt?: Date
}
