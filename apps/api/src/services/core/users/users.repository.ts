import type { Document, ObjectId } from 'mongodb'
import {
    QueryBuilderOptions,
    assignIfDefined,
    CrudRepository,
    DateUtil,
    MongoErrors,
    plainDateFromMongo,
    objectId,
    objectIds,
    QueryBuilder
} from '@mannercode/common'
import { Injectable, NotFoundException } from '@nestjs/common'
import { z } from 'zod'
import { AppConfigService, MongoConnection } from '#config'
import { CreateUserDto, SearchUsersPageDto, UpdateUserDto } from './dtos/index.js'
import { User } from './models/index.js'

const UserWriteSchema = z.strictObject({
    birthDate: z.instanceof(Temporal.PlainDate),
    email: z.string().min(1),
    name: z.string().min(1),
    password: z.string().min(1)
})
const UserPatchSchema = UserWriteSchema.partial()

@Injectable()
export class UsersRepository extends CrudRepository<User> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection.db.collection('users'),
            connection.client,
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize,
            {
                indexes: [{ key: { email: 1, deletedAt: 1 }, unique: true }],
                projection: { password: 0 }
            }
        )
    }

    async create(createDto: CreateUserDto): Promise<User> {
        UserWriteSchema.parse(createDto)
        const user = this.newDocument()
        user.name = createDto.name
        user.email = createDto.email
        user.birthDate = createDto.birthDate
        user.password = createDto.password
        user.authVersion = 0
        await this.insertOne(user)

        return user
    }

    async findByEmailWithPassword(email: string) {
        // 인증 계층이 그대로 쓸 수 있게 ObjectId를 문자열로 변환한다.
        const user = await this.collection.findOne(this.activeFilter({ email: { $eq: email } }))

        return user ? this.toDomainDocument(user) : null
    }

    async findAuthVersionById(userId: string): Promise<number | null> {
        const user = await this.collection.findOne(this.activeFilter({ _id: objectId(userId) }), {
            projection: { authVersion: 1 }
        })

        if (!user) return null
        return user.authVersion
    }

    async isAuthVersionCurrent(userId: string, authVersion: number): Promise<boolean> {
        const current = await this.findAuthVersionById(userId)
        return current !== null && current === authVersion
    }

    async advanceAuthVersion(userId: string): Promise<void> {
        const user = await this.collection.findOneAndUpdate(
            this.activeFilter({ _id: objectId(userId) }),
            this.timestamped({ $inc: { authVersion: 1 } }),
            { returnDocument: 'after' }
        )

        if (!user) throw new NotFoundException(MongoErrors.DocumentNotFound(userId))
    }

    async deleteByIdsWithAuthVersion(userIds: string[]): Promise<void> {
        await this.collection.updateMany(
            this.activeFilter({ _id: { $in: objectIds(userIds) } }),
            this.timestamped({ $inc: { authVersion: 1 }, $set: { deletedAt: DateUtil.now() } })
        )
    }

    async searchPage(searchDto: SearchUsersPageDto) {
        const { orderby, page, size } = searchDto

        const pagination = await this.findWithPagination({
            filter: this.buildQuery(searchDto, { allowEmpty: true }),
            pagination: {
                orderby: orderby ?? undefined,
                page: page ?? undefined,
                size: size ?? undefined
            }
        })

        return pagination
    }

    async update(userId: string, updateDto: UpdateUserDto) {
        UserPatchSchema.parse(updateDto)
        const patch: Partial<Pick<User, 'birthDate' | 'email' | 'name' | 'password'>> = {}
        assignIfDefined(patch, updateDto, 'name')
        assignIfDefined(patch, updateDto, 'email')
        assignIfDefined(patch, updateDto, 'birthDate')
        assignIfDefined(patch, updateDto, 'password')

        const update: Document = { $set: patch }
        if (updateDto.password !== undefined) update.$inc = { authVersion: 1 }

        const user = await this.collection.findOneAndUpdate(
            this.activeFilter({ _id: objectId(userId) }),
            this.timestamped(update),
            { projection: this.projection, returnDocument: 'after' }
        )

        if (!user) throw new NotFoundException(MongoErrors.DocumentNotFound(userId))

        return this.toDomainDocument(user)
    }

    private buildQuery(searchDto: SearchUsersPageDto, options: QueryBuilderOptions) {
        const { email, name } = searchDto

        const builder = new QueryBuilder<User>()
        builder.addRegex('name', name ?? undefined)
        builder.addRegex('email', email ?? undefined)

        const query = builder.build(options)
        return query
    }

    protected override toDomainDocument(doc: Document & { _id: ObjectId }): User {
        const user = super.toDomainDocument(doc)
        user.birthDate = plainDateFromMongo(user.birthDate)
        return user
    }
}
