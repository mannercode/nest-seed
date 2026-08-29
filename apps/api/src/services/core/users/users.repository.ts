import {
    QueryBuilderOptions,
    assignIfDefined,
    CrudRepository,
    isWriteConcernTimeoutError,
    MongooseErrors,
    objectId,
    objectIds,
    QueryBuilder,
    leanOneToPublic,
    leanToPublic,
    sleep
} from '@mannercode/common'
import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, UpdateQuery } from 'mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from '#config'
import { CreateUserDto, SearchUsersPageDto, UpdateUserDto } from './dtos/index.js'
import { User } from './models/index.js'

const CREATE_RECOVERY_POLL_MS = 100
const CREATE_RECOVERY_READ_MAX_TIME_MS = 250
const CREATE_RECOVERY_TIMEOUT_MS = 5_000

export type CreateUserResult = { status: 'conflict' } | { status: 'created'; user: User }
type PersistedUser = User & { _id: { toString(): string } }

@Injectable()
export class UsersRepository extends CrudRepository<User> {
    constructor(
        @InjectModel(User.name, MONGO_CONNECTION_NAME)
        readonly model: Model<User>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize, config.http.paginationMaxSize)
    }

    async create(createDto: CreateUserDto): Promise<CreateUserResult> {
        const user = this.newDocument()
        user.name = createDto.name
        user.email = createDto.email
        user.birthDate = createDto.birthDate
        user.password = createDto.password
        const attemptId = user._id.toString()

        try {
            await user.save()
        } catch (error) {
            if (!isWriteConcernTimeoutError(error)) throw error

            // wtimeout은 primary에 반영된 insert를 되돌리지 않는다. 같은 이메일을 다시 insert하면
            // 성공한 자기 요청도 duplicate key가 되므로, 최초 _id를 시도 ID로 삼아 majority 결과를 확인한다.
            const recovered = await this.recoverAmbiguousCreate(createDto.email, attemptId)
            if (recovered) return recovered

            // majority에서 결과를 확정하지 못한 경우에는 성공이나 충돌을 추측하지 않는다.
            throw error
        }

        return { status: 'created', user: user.toJSON() }
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

    async findAuthVersionById(userId: string): Promise<number | null> {
        const user = await this.model.findById(objectId(userId)).select('authVersion').lean().exec()

        return user ? ((user as { authVersion?: number }).authVersion ?? 0) : null
    }

    async isAuthVersionCurrent(userId: string, authVersion: number): Promise<boolean> {
        const current = await this.findAuthVersionById(userId)
        return current !== null && current === authVersion
    }

    async advanceAuthVersion(userId: string): Promise<void> {
        const user = await this.model
            .findOneAndUpdate(
                { _id: objectId(userId) },
                { $inc: { authVersion: 1 } },
                { returnDocument: 'after', runValidators: true }
            )
            .exec()

        if (!user) throw new NotFoundException(MongooseErrors.DocumentNotFound(userId))
    }

    async deleteByIdsWithAuthVersion(userIds: string[]): Promise<void> {
        await this.model
            .updateMany(
                { _id: { $in: objectIds(userIds) } },
                { $inc: { authVersion: 1 }, $set: { deletedAt: new Date() } }
            )
            .exec()
    }

    async searchPage(searchDto: SearchUsersPageDto) {
        const { orderby, page, size } = searchDto

        const pagination = await this.findWithPagination({
            configureQuery: async (queryHelper) => {
                const query = this.buildQuery(searchDto, { allowEmpty: true })

                queryHelper.setQuery(query)
            },
            pagination: {
                orderby: orderby ?? undefined,
                page: page ?? undefined,
                size: size ?? undefined
            }
        })

        return pagination
    }

    async update(userId: string, updateDto: UpdateUserDto) {
        const patch: Partial<Pick<User, 'birthDate' | 'email' | 'name' | 'password'>> = {}
        assignIfDefined(patch, updateDto, 'name')
        assignIfDefined(patch, updateDto, 'email')
        assignIfDefined(patch, updateDto, 'birthDate')
        assignIfDefined(patch, updateDto, 'password')

        const update: UpdateQuery<User> = { $set: patch }
        if (updateDto.password !== undefined) update.$inc = { authVersion: 1 }

        const user = await this.model
            .findOneAndUpdate({ _id: objectId(userId) }, update, {
                returnDocument: 'after',
                runValidators: true
            })
            .exec()

        if (!user) throw new NotFoundException(MongooseErrors.DocumentNotFound(userId))

        return user.toJSON()
    }

    private async recoverAmbiguousCreate(
        email: string,
        attemptId: string
    ): Promise<CreateUserResult | undefined> {
        const deadline = Date.now() + CREATE_RECOVERY_TIMEOUT_MS

        while (Date.now() < deadline) {
            try {
                const readTimeoutMs = Math.min(
                    CREATE_RECOVERY_READ_MAX_TIME_MS,
                    Math.max(1, deadline - Date.now())
                )
                const persisted = await this.model.collection.findOne<PersistedUser>(
                    { deletedAt: null, email },
                    {
                        maxTimeMS: readTimeoutMs,
                        readConcern: { level: 'majority' },
                        timeoutMS: readTimeoutMs
                    }
                )

                if (persisted) {
                    if (persisted._id.toString() !== attemptId) return { status: 'conflict' }

                    return { status: 'created', user: leanToPublic(persisted) }
                }
            } catch {
                // majority commit point가 아직 따라오지 않았거나 읽기가 일시 실패하면 제한 안에서 재확인한다.
            }

            const remainingMs = deadline - Date.now()
            if (remainingMs <= 0) break
            await sleep(Math.min(CREATE_RECOVERY_POLL_MS, remainingMs))
        }

        return undefined
    }

    private buildQuery(searchDto: SearchUsersPageDto, options: QueryBuilderOptions) {
        const { email, name } = searchDto

        const builder = new QueryBuilder<User>()
        builder.addRegex('name', name ?? undefined)
        builder.addRegex('email', email ?? undefined)

        const query = builder.build(options)
        return query
    }
}
