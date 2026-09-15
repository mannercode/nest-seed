import {
    type MongoDocument,
    QueryBuilderOptions,
    assignIfDefined,
    CrudRepository,
    DateUtil,
    isDuplicateKeyError,
    MongoErrors,
    plainDateFromMongo,
    QueryBuilder,
    MongoConnection
} from '@mannercode/common'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { z } from 'zod'
import { AppConfigService } from '#config'
import { CreateUserDto, SearchUsersPageDto, UpdateUserDto } from './dtos/index.js'
import { UserErrors } from './errors.js'
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
            connection,
            'users',
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
        try {
            await this.insertOne(user)
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                throw new ConflictException(UserErrors.EmailAlreadyExists(createDto.email))
            }
            throw error
        }

        return user
    }

    async findWithPassword({ email }: { email: string }) {
        const user = await this.findDocument(this.activeFilter({ email: { $eq: email } }))

        return user ? this.toDomainDocument(user) : null
    }

    async findAuthVersion({ id: userId }: { id: string }): Promise<number | null> {
        const user = await this.findDocument(this.activeFilter({ _id: userId }), {
            projection: { authVersion: 1 }
        })

        if (!user) return null
        return user.authVersion
    }

    async isAuthVersionCurrent(userId: string, authVersion: number): Promise<boolean> {
        const current = await this.findAuthVersion({ id: userId })
        return current !== null && current === authVersion
    }

    async advanceAuthVersion(userId: string): Promise<void> {
        const user = await this.findAndUpdateDocument(
            this.activeFilter({ _id: userId }),
            this.timestamped({ $inc: { authVersion: 1 } }),
            { returnDocument: 'after' }
        )

        if (!user) throw new NotFoundException(MongoErrors.DocumentNotFound(userId))
    }

    async deleteManyWithAuthVersion({ ids: userIds }: { ids: string[] }): Promise<void> {
        await this.updateDocuments(
            this.activeFilter({ _id: { $in: userIds } }),
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

        const update: MongoDocument = { $set: patch }
        if (updateDto.password !== undefined) update.$inc = { authVersion: 1 }

        try {
            const user = await this.findAndUpdateDocument(
                this.activeFilter({ _id: userId }),
                this.timestamped(update),
                { projection: this.projection, returnDocument: 'after' }
            )

            if (!user) throw new NotFoundException(MongoErrors.DocumentNotFound(userId))

            return this.toDomainDocument(user)
        } catch (error) {
            if (isDuplicateKeyError(error) && updateDto.email) {
                throw new ConflictException(UserErrors.EmailAlreadyExists(updateDto.email))
            }
            throw error
        }
    }

    private buildQuery(searchDto: SearchUsersPageDto, options: QueryBuilderOptions) {
        const { email, name } = searchDto

        const builder = new QueryBuilder<User>()
        builder.addRegex('name', name ?? undefined)
        builder.addRegex('email', email ?? undefined)

        const query = builder.build(options)
        return query
    }

    protected override toDomainDocument(doc: User): User {
        const user = super.toDomainDocument(doc)
        user.birthDate = plainDateFromMongo(user.birthDate)
        return user
    }
}
