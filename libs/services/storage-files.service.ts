import { Injectable } from '@nestjs/common'
import { MethodLog } from 'common'
import { nullStorageFileDto, StorageFileCreateDto, StorageFileDto } from 'types'

@Injectable()
export class StorageFilesService {
    constructor() {}

    @MethodLog()
    async saveFiles(createDtos: StorageFileCreateDto[]): Promise<StorageFileDto[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async getStorageFile(fileId: string): Promise<StorageFileDto> {
        return nullStorageFileDto
    }

    @MethodLog()
    async deleteStorageFile(fileId: string): Promise<boolean> {
        return true
    }
}
