import {
    type MongoDocument,
    assignIfDefined,
    CrudRepository,
    DateUtil,
    isDuplicateKeyError,
    MongoErrors,
    MongoConnection
} from '@mannercode/common'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { z } from 'zod'
import { AppConfigService } from '#config'
import type { CreateAdminDto, UpdateAdminDto } from './dtos/index.js'
import { AdminErrors } from './errors.js'
import { Admin } from './models/index.js'

const AdminWriteSchema = z.strictObject({
    email: z.string().min(1),
    name: z.string().min(1),
    password: z.string().min(1)
})
const AdminPatchSchema = AdminWriteSchema.partial()

@Injectable()
export class AdminsRepository extends CrudRepository<Admin> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection,
            'admins',
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize,
            {
                indexes: [{ key: { email: 1, deletedAt: 1 }, unique: true }],
                projection: { password: 0 }
            }
        )
    }

    async create(createDto: CreateAdminDto) {
        AdminWriteSchema.parse(createDto)
        const admin = this.newDocument()
        admin.email = createDto.email
        admin.name = createDto.name
        admin.password = createDto.password
        admin.authVersion = 0

        try {
            return await this.insertOne(admin)
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                throw new ConflictException(AdminErrors.EmailAlreadyExists(createDto.email))
            }
            throw error
        }
    }

    async findWithPassword({ email }: { email: string }) {
        const admin = await this.findDocument(this.activeFilter({ email: { $eq: email } }))

        return admin
    }

    async findAuthVersion({ id: adminId }: { id: string }): Promise<number | null> {
        const admin = await this.findDocument(this.activeFilter({ _id: adminId }), {
            projection: { authVersion: 1 }
        })

        if (!admin) return null
        return admin.authVersion
    }

    async isAuthVersionCurrent(adminId: string, authVersion: number): Promise<boolean> {
        const current = await this.findAuthVersion({ id: adminId })
        return current !== null && current === authVersion
    }

    async deleteWithAuthVersion({ id: adminId }: { id: string }): Promise<void> {
        const admin = await this.findAndUpdateDocument(
            this.activeFilter({ _id: adminId }),
            this.timestamped({ $inc: { authVersion: 1 }, $set: { deletedAt: DateUtil.now() } }),
            { returnDocument: 'before' }
        )

        if (!admin) throw new NotFoundException(MongoErrors.DocumentNotFound(adminId))
    }

    async update(id: string, patch: UpdateAdminDto) {
        AdminPatchSchema.parse(patch)
        const fields: Partial<Pick<Admin, 'email' | 'name' | 'password'>> = {}
        assignIfDefined(fields, patch, 'email')
        assignIfDefined(fields, patch, 'name')
        assignIfDefined(fields, patch, 'password')

        const update: MongoDocument = { $set: fields }
        if (patch.password !== undefined) update.$inc = { authVersion: 1 }

        try {
            const doc = await this.findAndUpdateDocument(
                this.activeFilter({ _id: id }),
                this.timestamped(update),
                { projection: this.projection, returnDocument: 'after' }
            )

            if (!doc) throw new NotFoundException(MongoErrors.DocumentNotFound(id))
            return doc
        } catch (error) {
            if (isDuplicateKeyError(error) && patch.email) {
                throw new ConflictException(AdminErrors.EmailAlreadyExists(patch.email))
            }
            throw error
        }
    }
}
