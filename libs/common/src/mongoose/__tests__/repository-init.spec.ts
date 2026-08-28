import type { Model } from 'mongoose'
import { CrudRepository } from '../crud.repository'

type Sample = { name: string }

class SampleCrudRepository extends CrudRepository<Sample> {
    constructor(model: Model<Sample>) {
        super(model, 10, 100)
    }
}

describe('repository initialization', () => {
    it('Mongoose가 시작한 모델 초기화만 기다린다', async () => {
        const init = jest.fn(async () => undefined)
        const createCollection = jest.fn()
        const createIndexes = jest.fn()
        const model = { createCollection, createIndexes, init } as unknown as Model<Sample>
        const repository = new SampleCrudRepository(model)

        await repository.onModuleInit()

        expect(init).toHaveBeenCalledTimes(1)
        expect(createCollection).not.toHaveBeenCalled()
        expect(createIndexes).not.toHaveBeenCalled()
    })
})
