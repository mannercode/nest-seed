import { Controller, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Subjects } from 'shared/config'
import { StorageFileCreateDto } from './dtos'
import { StorageFilesService } from './storage-files.service'

@Controller()
export class StorageFilesController {
    constructor(private service: StorageFilesService) {}

    @MessagePattern(Subjects.StorageFiles.saveFiles)
    saveFiles(
        @Payload(new ParseArrayPipe({ items: StorageFileCreateDto }))
        createDtos: StorageFileCreateDto[]
    ) {
        return this.service.saveFiles(createDtos)
    }

    @MessagePattern(Subjects.StorageFiles.getStorageFile)
    getStorageFile(@Payload() fileId: string) {
        return this.service.getStorageFile(fileId)
    }

    @MessagePattern(Subjects.StorageFiles.deleteStorageFile)
    deleteStorageFile(@Payload() fileId: string) {
        return this.service.deleteStorageFile(fileId)
    }
}
