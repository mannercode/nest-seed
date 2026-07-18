import {
    QueryBuilderOptions,
    assignIfDefined,
    CrudRepository,
    QueryBuilder,
    leanOneToPublic
} from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'
import { Model } from 'mongoose'
import { CreateUserDto, SearchUsersPageDto, UpdateUserDto } from './dtos'
import { User } from './models'

@Injectable()
export class UsersRepository extends CrudRepository<User> {
    constructor(
        @InjectModel(User.name, MONGO_CONNECTION_NAME)
        readonly model: Model<User>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize, config.http.paginationMaxSize)
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

    async findByEmailWithPassword(email: string) {
        // 인증 계층이 그대로 쓸 수 있게 ObjectId를 문자열로 변환한다.
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
        assignIfDefined(user, updateDto, 'password')

        await user.save()

        return user.toJSON()
    }

    private buildQuery(searchDto: SearchUsersPageDto, options: QueryBuilderOptions) {
        const { email, name } = searchDto

        const builder = new QueryBuilder<User>()
        builder.addRegex('name', name)
        builder.addRegex('email', email)

        const query = builder.build(options)
        return query
    }
}
