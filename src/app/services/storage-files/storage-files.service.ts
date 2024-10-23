import { Injectable } from '@nestjs/common'
import { getChecksum, MethodLog, objectId, ObjectId, Path } from 'common'
import { AppConfigService } from 'config'
import { StorageFileCreateDto, StorageFileDto } from './dtos'
import { StorageFile } from './models'
import { StorageFilesRepository } from './storage-files.repository'

@Injectable()
export class StorageFilesService {
    constructor(
        private repository: StorageFilesRepository,
        private config: AppConfigService
    ) {}

    @MethodLog()
    async saveFiles(createDtos: StorageFileCreateDto[]) {
        const storageFiles = await this.repository.withTransaction(async (session) => {
            const storageFiles: StorageFile[] = []

            for (const createDto of createDtos) {
                const storageFile = await this.repository.createStorageFile(
                    { ...createDto, checksum: await getChecksum(createDto.uploadedFilePath) },
                    session
                )
                Path.copy(createDto.uploadedFilePath, this.getStoragePath(storageFile.id))

                storageFiles.push(storageFile)
            }

            return storageFiles
        })

        return storageFiles.map((file) => this.createStorageFileDto(file))
    }

    @MethodLog({ level: 'verbose' })
    async getStorageFile(fileId: string) {
        const file = await this.repository.getStorageFile(objectId(fileId))
        return this.createStorageFileDto(file!)
    }

    @MethodLog()
    async deleteStorageFile(fileId: string) {
        await this.repository.deleteStorageFile(objectId(fileId))

        const targetPath = this.getStoragePath(objectId(fileId))
        await Path.delete(targetPath)

        return true
    }

    private createStorageFileDto(file: StorageFile) {
        const dto = new StorageFileDto(file, this.getStoragePath(file.id))
        return dto
    }

    private getStoragePath(fileId: ObjectId) {
        const path = Path.join(this.config.fileUpload.directory, `${fileId}.file`)
        return path
    }
}
