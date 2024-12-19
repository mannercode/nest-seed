import { Injectable } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { StorageFileCreateDto } from './dtos'
import { StorageFilesService } from './storage-files.service'

@Injectable()
export class StorageFilesController {
    constructor(private service: StorageFilesService) {}

    @MessagePattern({ cmd: 'saveFiles' })
    saveFiles(@Payload() createDtos: StorageFileCreateDto[]) {
        return this.service.saveFiles(createDtos)
    }

    @MessagePattern({ cmd: 'getStorageFile' })
    getStorageFile(@Payload() fileId: string) {
        return this.service.getStorageFile(fileId)
    }

    @MessagePattern({ cmd: 'deleteStorageFile' })
    deleteStorageFile(@Payload() fileId: string) {
        return this.service.deleteStorageFile(fileId)
    }
}
