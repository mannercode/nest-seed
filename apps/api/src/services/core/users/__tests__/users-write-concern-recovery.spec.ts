import { plainDate } from '@mannercode/testing'
import { ConflictException } from '@nestjs/common'
import { ObjectId, type Collection, type Document } from 'mongodb'
import { UsersRepository, UsersService } from '../index.js'

describe('user create write concern recovery', () => {
    const createDto = {
        birthDate: plainDate('1990-01-01'),
        email: 'ambiguous@example.com',
        name: 'ambiguous',
        password: 'password'
    }

    let collection: Collection
    let repository: UsersRepository
    let service: UsersService

    beforeEach(() => {
        collection = createCollection()
        repository = new UsersRepository(
            { client: {}, db: { collection: () => collection } } as any,
            { http: { paginationDefaultSize: 10, paginationMaxSize: 100 } } as any
        )
        service = new UsersService(repository, {
            hash: vi.fn().mockResolvedValue('hashed-password')
        } as any)
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('wtimeout 뒤 majority read에서 같은 시도 _id가 보이면 생성 성공으로 복구한다', async () => {
        const originalError = writeConcernTimeoutError()
        let attemptId: ObjectId | undefined
        vi.spyOn(collection, 'insertOne').mockImplementation(async (document) => {
            attemptId = document._id
            throw originalError
        })
        const findOne = vi.spyOn(collection, 'findOne').mockImplementation(async () => {
            if (!attemptId) throw new Error('The attempted user id was not captured')
            return persistedUser(attemptId)
        })

        const result = await service.create(createDto)

        expect(result).toEqual({
            birthDate: createDto.birthDate,
            email: createDto.email,
            id: attemptId?.toHexString(),
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
        vi.spyOn(collection, 'insertOne').mockRejectedValue(originalError)
        vi.spyOn(collection, 'findOne').mockResolvedValue(persistedUser(new ObjectId()))

        await expect(service.create(createDto)).rejects.toBeInstanceOf(ConflictException)
    })

    it('bounded majority read로 결과를 확인하지 못하면 원래 wtimeout을 전파한다', async () => {
        vi.useFakeTimers()
        const originalError = writeConcernTimeoutError()
        vi.spyOn(collection, 'insertOne').mockRejectedValue(originalError)
        const findOne = vi.spyOn(collection, 'findOne').mockResolvedValue(null)

        const result = service.create(createDto).catch((error: unknown) => error)
        await vi.runAllTimersAsync()

        await expect(result).resolves.toBe(originalError)
        expect(findOne).toHaveBeenCalledTimes(50)
    })

    it('majority read가 deadline을 소진하면 더 기다리지 않고 원래 wtimeout을 전파한다', async () => {
        vi.useFakeTimers()
        const originalError = writeConcernTimeoutError()
        vi.spyOn(collection, 'insertOne').mockRejectedValue(originalError)
        vi.spyOn(performance, 'now')
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0)
            .mockReturnValue(5_000)
        const findOne = vi.spyOn(collection, 'findOne').mockImplementation(async () => null)

        const result = service.create(createDto).catch((error: unknown) => error)

        await expect(result).resolves.toBe(originalError)
        expect(findOne).toHaveBeenCalledTimes(1)
    })
})

function createCollection(): Collection {
    return {
        async findOne() {
            return null
        },
        async insertOne(document: Document) {
            return { acknowledged: true, insertedId: document._id as ObjectId }
        }
    } as unknown as Collection
}

function persistedUser(id: ObjectId) {
    return {
        _id: id,
        birthDate: new Date('1990-01-01'),
        createdAt: new Date(),
        deletedAt: null,
        email: 'ambiguous@example.com',
        name: 'ambiguous',
        password: 'hashed-password',
        updatedAt: new Date()
    }
}

function writeConcernTimeoutError() {
    return Object.assign(new Error('waiting for replication timed out'), {
        code: 64,
        codeName: 'WriteConcernFailed',
        errInfo: { wtimeout: true },
        name: 'MongoWriteConcernError'
    })
}
