import { Injectable } from '@nestjs/common'
import { InjectS3Object, mapDocToDto, Path, S3ObjectService } from 'common'
import { AppConfigService } from 'shared'
import {
    AttachmentDto,
    CompleteAttachmentDto,
    CreateAttachmentDto,
    CreateAttachmentResponse
} from './dtos'
import { AttachmentDocument } from './models'
import { AttachmentsRepository } from './attachments.repository'

const DEFAULT_PRESIGN_EXPIRES_SEC = 60

@Injectable()
export class AttachmentsService {
    constructor(
        private repository: AttachmentsRepository,
        private config: AppConfigService,
        @InjectS3Object() private s3Service: S3ObjectService
    ) {}

    async getMany(fileIds: string[]) {
        const files = await this.repository.getByIds(fileIds)

        return Promise.all(
            files.map((file) => this.toDtoWithDownloadUrl(file, DEFAULT_PRESIGN_EXPIRES_SEC))
        )
    }

    async create(dto: CreateAttachmentDto): Promise<CreateAttachmentResponse> {
        const attachment = await this.repository.createAttachment(dto)
        const attachmentId = attachment.id

        const expiresInSec = DEFAULT_PRESIGN_EXPIRES_SEC

        const uploadUrl = await this.s3Service.presignUploadUrl({
            key: attachmentId,
            expiresInSec,
            contentType: dto.mimeType,
            contentLength: dto.size
        })

        return {
            attachmentId,
            uploadUrl,
            expiresAt: this.getExpiresAt(expiresInSec),
            method: 'PUT' as const,
            headers: { 'Content-Type': dto.mimeType, 'Content-Length': dto.size.toString() }
        }
    }

    async complete(dto: CompleteAttachmentDto) {
        const attachment = await this.repository.update(dto.attachmentId, {
            ownerService: dto.ownerService,
            ownerEntityId: dto.ownerEntityId
        })

        return this.toDto(attachment)
    }

    async deleteMany(attachmentIds: string[]) {
        const deletedFiles = await this.repository.deleteByIds(attachmentIds)

        for (const attachmentId of attachmentIds) {
            await this.s3Service.deleteObject(attachmentId)
        }

        return { deletedAttachments: this.toDtos(deletedFiles) }
    }

    // private getAttachmentPath(fileId: string) {
    //     const path = Path.join(this.config.fileUpload.directory, `${fileId}.file`)
    //     return path
    // }

    private getExpiresAt(expiresInSec: number) {
        return new Date(Date.now() + expiresInSec * 1000)
    }

    private toDto = (file: AttachmentDocument): AttachmentDto => {
        const dto = mapDocToDto(file, AttachmentDto, [
            'id',
            'originalName',
            'mimeType',
            'size',
            'checksum',
            'ownerService',
            'ownerEntityId'
        ])

        return dto
    }
    private async toDtoWithDownloadUrl(file: AttachmentDocument, expiresInSec: number) {
        const dto = this.toDto(file)
        const downloadUrl = await this.s3Service.presignDownloadUrl({ key: file.id, expiresInSec })

        dto.downloadUrl = downloadUrl
        dto.downloadUrlExpiresAt = this.getExpiresAt(expiresInSec)

        return dto
    }
    private toDtos = (files: AttachmentDocument[]) => files.map((file) => this.toDto(file))
}
