import { Injectable } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { StorageFileCreateDto } from 'types'
import { StorageFilesService } from './storage-files.service'

@Injectable()
export class StorageFilesController {
    constructor(private service: StorageFilesService) {}

    @MessagePattern({ cmd: 'saveFiles' })
    async saveFiles(@Payload() createDtos: StorageFileCreateDto[]) {
        return this.service.saveFiles(createDtos)
    }

    @MessagePattern({ cmd: 'getStorageFile' })
    async getStorageFile(@Payload() fileId: string) {
        return this.service.getStorageFile(fileId)
    }

    @MessagePattern({ cmd: 'deleteStorageFile' })
    async deleteStorageFile(@Payload() fileId: string) {
        return this.service.deleteStorageFile(fileId)
    }
}
