import {
    assignIfDefined,
    MongoDocumentRepository,
    isDuplicateKeyError,
    MongoErrors,
    plainDateFromMongo,
    MongoConnection,
    type TransactionContext
} from '@mannercode/common'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { z } from 'zod'
import { CreateUserDto, UpdateUserDto } from './dtos/index.js'
import { UserErrors } from './errors.js'
import { User } from './models/index.js'

const UserWriteSchema = z.strictObject({
    birthDate: z.instanceof(Temporal.PlainDate),
    email: z.string().min(1),
    name: z.string().min(1),
    password: z.string().min(1)
})
const UserPatchSchema = UserWriteSchema.partial()
const userProjection = { password: 0 } as const

@Injectable()
export class UsersRepository extends MongoDocumentRepository<User, typeof userProjection> {
    constructor(connection: MongoConnection) {
        super(connection, 'users', {
            indexes: [{ key: { email: 1, deletedAt: 1 }, unique: true }],
            projection: userProjection
        })
    }

    async create(
        createDto: CreateUserDto,
        photoAssetId: string | null,
        transaction?: TransactionContext
    ): Promise<User> {
        UserWriteSchema.parse(createDto)
        const user = this.newDocument()
        user.authVersion = 0
        user.name = createDto.name
        user.email = createDto.email
        user.birthDate = createDto.birthDate
        user.password = createDto.password
        user.photoAssetId = photoAssetId
        try {
            await this.insertOne(user, transaction)
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                throw new ConflictException(UserErrors.EmailAlreadyExists(createDto.email))
            }
            throw error
        }

        return user
    }

    async findForAuthentication({ email }: { email: string }) {
        const user = await this.findDocument(this.activeFilter({ email: { $eq: email } }))

        return user ? this.toDomainDocument(user) : null
    }

    async update(userId: string, updateDto: UpdateUserDto) {
        UserPatchSchema.parse(updateDto)
        const patch: Partial<Pick<User, 'birthDate' | 'email' | 'name' | 'password'>> = {}
        assignIfDefined(patch, updateDto, 'name')
        assignIfDefined(patch, updateDto, 'email')
        assignIfDefined(patch, updateDto, 'birthDate')
        assignIfDefined(patch, updateDto, 'password')
        const update = this.timestamped({ $set: patch })
        if (patch.password !== undefined) update.$inc.authVersion = 1

        try {
            const user = await this.findAndUpdateDocument(
                this.activeFilter(this.idFilter(userId)),
                update,
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

    protected override toDomainDocument<T extends Omit<User, 'password'>>(doc: T): T {
        doc.birthDate = plainDateFromMongo(doc.birthDate)
        return doc
    }
}
