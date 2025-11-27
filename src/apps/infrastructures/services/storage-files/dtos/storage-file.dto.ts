export class StorageFileDto {
    id: string
    originalName: string
    mimeType: string
    size: number
    checksum: string
    storedPath: string
    ownerService: string | null
    ownerEntityId: string | null
}
