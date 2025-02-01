import { BaseDto } from "common"

export class StorageFileDto extends BaseDto {
    id: string
    originalname: string
    mimetype: string
    size: number
    checksum: string
    storedPath: string
}

export const nullStorageFileDto = {
    id: '',
    originalname: '',
    mimetype: '',
    size: 0,
    checksum: '',
    storedPath: ''
}
