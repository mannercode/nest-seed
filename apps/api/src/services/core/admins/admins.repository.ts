import { CrudRepository, leanOneToPublic } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'
import { Model } from 'mongoose'
import { CreateAdminDto } from './dtos'
import { Admin } from './models'

@Injectable()
export class AdminsRepository extends CrudRepository<Admin> {
    constructor(
        @InjectModel(Admin.name, MONGO_CONNECTION_NAME)
        readonly model: Model<Admin>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize)
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
}
