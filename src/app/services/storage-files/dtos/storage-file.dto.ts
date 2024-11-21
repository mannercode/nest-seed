import { StorageFile } from '../models'

export class StorageFileDto {
    id: string
    originalname: string
    mimetype: string
    size: number
    storedPath: string
    checksum: string

    constructor(file: StorageFile, storedPath: string) {
        // const { id, originalname, mimetype, size, checksum } = file

        // Object.assign(this, {
        //     id: id.toString(),
        //     originalname,
        //     mimetype,
        //     size,
        //     storedPath,
        //     checksum
        // })
        const { createdAt, updatedAt, __v, ...rest } = file

        Object.assign(this, { ...rest, storedPath })
    }
}
