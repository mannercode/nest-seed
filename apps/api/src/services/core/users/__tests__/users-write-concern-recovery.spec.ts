import { ConflictException } from '@nestjs/common'
import { deleteModel, model, Types } from 'mongoose'
import { type User, UserSchema } from '../models/index.js'
import { UsersRepository } from '../users.repository.js'
import { UsersService } from '../users.service.js'

const MODEL_NAME = 'UserWriteConcernRecoverySpec'
const userModel = model<User>(MODEL_NAME, UserSchema.clone())

describe('user create write concern recovery', () => {
    const createDto = {
        birthDate: new Date('1990-01-01'),
        email: 'ambiguous@example.com',
        name: 'ambiguous',
        password: 'password'
    }

    let repository: UsersRepository
    let service: UsersService

    beforeEach(() => {
        repository = new UsersRepository(userModel, {
            http: { paginationDefaultSize: 10, paginationMaxSize: 100 }
        } as any)
        service = new UsersService(repository, {
            hash: jest.fn().mockResolvedValue('hashed-password')
        } as any)
    })

    afterEach(() => {
        jest.useRealTimers()
        jest.restoreAllMocks()
    })

    afterAll(() => {
        deleteModel(MODEL_NAME)
    })

    it('wtimeout 뒤 majority read에서 같은 시도 _id가 보이면 생성 성공으로 복구한다', async () => {
        const originalError = writeConcernTimeoutError()
        let attemptId: Types.ObjectId | undefined
        jest.spyOn(userModel.prototype, 'save').mockImplementation(function (this: {
            _id: Types.ObjectId
        }) {
            attemptId = this._id
            return Promise.reject(originalError)
        })
        const findOne = jest
            .spyOn(userModel.collection, 'findOne')
            .mockImplementation(async () => persistedUser(attemptId))

        const result = await service.create(createDto)

        expect(result).toEqual({
            birthDate: createDto.birthDate,
            email: createDto.email,
            id: attemptId?.toString(),
            name: createDto.name
        })
        expect(findOne).toHaveBeenCalledWith(
            { deletedAt: null, email: createDto.email },
            expect.objectContaining({
                maxTimeMS: expect.any(Number),
                readConcern: { level: 'majority' },
                timeoutMS: expect.any(Number)
            })
        )
    })

    it('wtimeout 뒤 같은 이메일의 다른 _id가 보이면 409 conflict로 확정한다', async () => {
        const originalError = writeConcernTimeoutError()
        jest.spyOn(userModel.prototype, 'save').mockRejectedValue(originalError)
        jest.spyOn(userModel.collection, 'findOne').mockResolvedValue(
            persistedUser(new Types.ObjectId())
        )

        await expect(service.create(createDto)).rejects.toBeInstanceOf(ConflictException)
    })

    it('bounded majority read로 결과를 확인하지 못하면 원래 wtimeout을 전파한다', async () => {
        jest.useFakeTimers()
        const originalError = writeConcernTimeoutError()
        jest.spyOn(userModel.prototype, 'save').mockRejectedValue(originalError)
        const findOne = jest.spyOn(userModel.collection, 'findOne').mockResolvedValue(null)

        const result = service.create(createDto).catch((error: unknown) => error)
        await jest.runAllTimersAsync()

        await expect(result).resolves.toBe(originalError)
        expect(findOne).toHaveBeenCalledTimes(50)
    })

    it('majority read가 deadline을 소진하면 더 기다리지 않고 원래 wtimeout을 전파한다', async () => {
        jest.useFakeTimers()
        const originalError = writeConcernTimeoutError()
        jest.spyOn(userModel.prototype, 'save').mockRejectedValue(originalError)
        const findOne = jest.spyOn(userModel.collection, 'findOne').mockImplementation(async () => {
            jest.setSystemTime(Date.now() + 5_000)
            return null
        })

        const result = service.create(createDto).catch((error: unknown) => error)

        await expect(result).resolves.toBe(originalError)
        expect(findOne).toHaveBeenCalledTimes(1)
    })
})

function persistedUser(id: Types.ObjectId | undefined) {
    return {
        _id: id,
        birthDate: new Date('1990-01-01'),
        createdAt: new Date(),
        deletedAt: null,
        email: 'ambiguous@example.com',
        name: 'ambiguous',
        password: 'hashed-password',
        updatedAt: new Date()
    } as any
}

function writeConcernTimeoutError() {
    return Object.assign(new Error('waiting for replication timed out'), {
        code: 64,
        codeName: 'WriteConcernFailed',
        errInfo: { wtimeout: true },
        name: 'MongoWriteConcernError'
    })
}
