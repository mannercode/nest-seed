import { Injectable } from '@nestjs/common'
import { getChecksum, mapDocToDto, MethodLog, Path } from 'common'
import { AppConfigService } from 'config'
import { HydratedDocument } from 'mongoose'
import { StorageFileCreateDto, StorageFileDto } from './dtos'
import { StorageFile, StorageFileDocument } from './models'
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
                    createDto,
                    checksum,
                    session
                )
                // move가 아니라 copy하기 때문에 성능 영향이 있다
                await Path.copy(createDto.path, this.getStoragePath(storageFile.id))

                storageFiles.push(storageFile)
            }

            return storageFiles
        })

        return this.toDtos(storageFiles)
    }

    @MethodLog({ level: 'verbose' })
    async getStorageFile(fileId: string) {
        const file = await this.repository.getById(fileId)
        return this.toDto(file)
    }

    @MethodLog()
    async deleteStorageFile(fileId: string) {
        await this.repository.deleteById(fileId)

        const targetPath = this.getStoragePath(fileId)
        await Path.delete(targetPath)

        return true
    }

    private getStoragePath(fileId: string) {
        const path = Path.join(this.config.fileUpload.directory, `${fileId}.file`)
        return path
    }

    private toDto = (file: StorageFileDocument) => {
        const dto = mapDocToDto(file, StorageFileDto, [
            'id',
            'originalname',
            'mimetype',
            'size',
            'checksum'
        ])
        dto.storedPath = this.getStoragePath(file.id)

        return dto
    }
    private toDtos = (files: StorageFileDocument[]) => files.map((file) => this.toDto(file))
}
