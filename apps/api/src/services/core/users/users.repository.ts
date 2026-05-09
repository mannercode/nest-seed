import {
    QueryBuilderOptions,
    assignIfDefined,
    CrudRepository,
    QueryBuilder,
    leanOneToPublic
} from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'config'
import { Model } from 'mongoose'
import { CreateUserDto, SearchUsersPageDto, UpdateUserDto } from './dtos'
import { User } from './models'

@Injectable()
export class UsersRepository extends CrudRepository<User> {
    constructor(
        @InjectModel(User.name, MongooseConfigModule.connectionName)
        readonly model: Model<User>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async create(createDto: CreateUserDto) {
        const user = this.newDocument()
        user.name = createDto.name
        user.email = createDto.email
        user.birthDate = createDto.birthDate
        user.password = createDto.password

        await user.save()

        return user.toJSON()
    }

    async existsByEmail(email: string): Promise<boolean> {
        const result = await this.model.exists({ email: { $eq: email } }).lean()

        // 값을 boolean 타입으로 강제 변환
        return !!result
    }

    async findByEmailWithPassword(email: string) {
        // cycle-19: lean-virtuals 플러그인 제거 + leanToPublic (cycle-06 패턴).
        // login 경로라 user.id 가 후속 auth 처리에서 쓰임 — 보존.
        const user = await this.model
            .findOne({ email: { $eq: email } })
            .select('+password')
            .lean()
            .exec()

        return leanOneToPublic<User>(user)
    }

    async searchPage(searchDto: SearchUsersPageDto) {
        const { orderby, page, size } = searchDto

        const pagination = await this.findWithPagination({
            configureQuery: async (queryHelper) => {
                const query = this.buildQuery(searchDto, { allowEmpty: true })

                queryHelper.setQuery(query)
            },
            pagination: { orderby, page, size }
        })

        return pagination
    }

    async update(userId: string, updateDto: UpdateUserDto) {
        const user = await this.getDocumentById(userId)

        assignIfDefined(user, updateDto, 'name')
        assignIfDefined(user, updateDto, 'email')
        assignIfDefined(user, updateDto, 'birthDate')

        await user.save()

        return user.toJSON()
    }

    private buildQuery(searchDto: SearchUsersPageDto, options: QueryBuilderOptions) {
        const { email, name } = searchDto

        const builder = new QueryBuilder<User>()
        // substring + case-insensitive 유지 (cycle-31 원복).
        builder.addRegex('name', name)
        builder.addRegex('email', email)

        const query = builder.build(options)
        return query
    }
}
