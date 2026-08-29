import {
    assignIfDefined,
    CrudRepository,
    leanOneToPublic,
    MongooseErrors,
    objectId
} from '@mannercode/common'
import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, UpdateQuery } from 'mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from '#config'
import { CreateAdminDto } from './dtos/index.js'
import { Admin } from './models/index.js'

@Injectable()
export class AdminsRepository extends CrudRepository<Admin> {
    constructor(
        @InjectModel(Admin.name, MONGO_CONNECTION_NAME)
        readonly model: Model<Admin>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize, config.http.paginationMaxSize)
    }

    async create(createDto: CreateAdminDto) {
        const admin = this.newDocument()
        admin.email = createDto.email
        admin.name = createDto.name
        admin.password = createDto.password

        await admin.save()

        return admin.toJSON()
    }

    async findByEmailWithPassword(email: string) {
        const admin = await this.model
            .findOne({ email: { $eq: email } })
            .select('+password')
            .lean()
            .exec()

        return leanOneToPublic<Admin>(admin)
    }

    async findAuthVersionById(adminId: string): Promise<number | null> {
        const admin = await this.model
            .findById(objectId(adminId))
            .select('authVersion')
            .lean()
            .exec()

        return admin ? ((admin as { authVersion?: number }).authVersion ?? 0) : null
    }

    async isAuthVersionCurrent(adminId: string, authVersion: number): Promise<boolean> {
        const current = await this.findAuthVersionById(adminId)
        return current !== null && current === authVersion
    }

    async deleteByIdWithAuthVersion(adminId: string): Promise<void> {
        const admin = await this.model
            .findOneAndUpdate(
                { _id: objectId(adminId) },
                { $inc: { authVersion: 1 }, $set: { deletedAt: new Date() } },
                { returnDocument: 'before' }
            )
            .exec()

        if (!admin) throw new NotFoundException(MongooseErrors.DocumentNotFound(adminId))
    }

    async update(id: string, patch: Partial<Pick<Admin, 'email' | 'name' | 'password'>>) {
        const fields: Partial<Pick<Admin, 'email' | 'name' | 'password'>> = {}
        assignIfDefined(fields, patch, 'email')
        assignIfDefined(fields, patch, 'name')
        assignIfDefined(fields, patch, 'password')

        const update: UpdateQuery<Admin> = { $set: fields }
        if (patch.password !== undefined) update.$inc = { authVersion: 1 }

        const doc = await this.model
            .findOneAndUpdate({ _id: objectId(id) }, update, {
                returnDocument: 'after',
                runValidators: true
            })
            .exec()

        if (!doc) throw new NotFoundException(MongooseErrors.DocumentNotFound(id))
        return doc.toJSON()
    }
}
