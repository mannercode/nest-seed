import type { Document } from 'mongodb'
import {
    assignIfDefined,
    CrudRepository,
    mongoToPublic,
    MongoErrors,
    objectId
} from '@mannercode/common'
import { Injectable, NotFoundException } from '@nestjs/common'
import { z } from 'zod'
import { AppConfigService, MongoConnection } from '#config'
import type { CreateAdminDto, UpdateAdminDto } from './dtos/index.js'
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
            connection.db.collection('admins'),
            connection.client,
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

        return this.insertOne(admin)
    }

    async findByEmailWithPassword(email: string) {
        const admin = await this.collection.findOne(this.activeFilter({ email: { $eq: email } }))

        return mongoToPublic<Admin>(admin)
    }

    async findAuthVersionById(adminId: string): Promise<number | null> {
        const admin = await this.collection.findOne(this.activeFilter({ _id: objectId(adminId) }), {
            projection: { authVersion: 1 }
        })

        return admin ? ((admin as { authVersion?: number }).authVersion ?? 0) : null
    }

    async isAuthVersionCurrent(adminId: string, authVersion: number): Promise<boolean> {
        const current = await this.findAuthVersionById(adminId)
        return current !== null && current === authVersion
    }

    async deleteByIdWithAuthVersion(adminId: string): Promise<void> {
        const admin = await this.collection.findOneAndUpdate(
            this.activeFilter({ _id: objectId(adminId) }),
            this.timestamped({ $inc: { authVersion: 1 }, $set: { deletedAt: new Date() } }),
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

        const update: Document = { $set: fields }
        if (patch.password !== undefined) update.$inc = { authVersion: 1 }

        const doc = await this.collection.findOneAndUpdate(
            this.activeFilter({ _id: objectId(id) }),
            this.timestamped(update),
            { projection: this.projection, returnDocument: 'after' }
        )

        if (!doc) throw new NotFoundException(MongoErrors.DocumentNotFound(id))
        return mongoToPublic<Admin>(doc)
    }
}
