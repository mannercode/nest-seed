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
        super(model, config.http.paginationDefaultSize)
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
        return !!result
    }

    async findByEmailWithPassword(email: string) {
        // 로그인 경로이다. 뒤이은 인증 처리에서 `user.id`를 그대로 써야 하므로
        // `leanOneToPublic`으로 ObjectId를 문자열로 바꿔 둔다.
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
        // API 계약은 대소문자를 구분하지 않는 부분 문자열 검색이다. 일반 Mongo
        // 인덱스를 활용하지 못하는 형태지만, 시드의 검색 동작을 명확히 보여 주려고 유지한다.
        builder.addRegex('name', name)
        builder.addRegex('email', email)

        const query = builder.build(options)
        return query
    }
}
