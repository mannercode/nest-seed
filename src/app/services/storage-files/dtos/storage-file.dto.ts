import { StorageFile } from '../models'

export class StorageFileDto {
    id: string
    originalname: string
    mimetype: string
    size: number
    storedPath: string
    checksum: string

    constructor(file: StorageFile, storedPath: string) {
        const { createdAt, updatedAt, __v, ...rest } = file

        Object.assign(this, { ...rest, storedPath })
    }
}
