import { Injectable } from '@nestjs/common'
import { getChecksum, MethodLog, objectId, ObjectId, Path, toDto } from 'common'
import { AppConfigService } from 'config'
import { HydratedDocument } from 'mongoose'
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
            const storageFiles: HydratedDocument<StorageFile>[] = []

            for (const createDto of createDtos) {
                const checksum = await getChecksum(createDto.path)
                const storageFile = await this.repository.createStorageFile(
                    { ...createDto, checksum },
                    session
                )
                // move가 아니라 copy하기 때문에 성능 영향이 있다
                await Path.copy(createDto.path, this.getStoragePath(storageFile.id))

                storageFiles.push(storageFile)
            }

            return storageFiles
        })

        return storageFiles.map((file) => this.createStorageFileDto(file))
    }

    @MethodLog({ level: 'verbose' })
    async getStorageFile(fileId: string) {
        const file = await this.repository.getById(objectId(fileId))
        return this.createStorageFileDto(file)
    }

    @MethodLog()
    async deleteStorageFile(fileId: string) {
        await this.repository.deleteById(objectId(fileId))

        const targetPath = this.getStoragePath(objectId(fileId))
        await Path.delete(targetPath)

        return true
    }

    private createStorageFileDto(file: HydratedDocument<StorageFile>) {
        const dto = toDto(file, StorageFileDto, this.getStoragePath(file.id))
        return dto
    }

    private getStoragePath(fileId: ObjectId) {
        const path = Path.join(this.config.fileUpload.directory, `${fileId}.file`)
        return path
    }
}
