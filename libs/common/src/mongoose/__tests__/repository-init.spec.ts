import type { Model } from 'mongoose'
import { AppendOnlyRepository } from '../append-only.repository.js'
import { CrudRepository } from '../crud.repository.js'

type Sample = { name: string }

class SampleCrudRepository extends CrudRepository<Sample> {
    constructor(model: Model<Sample>) {
        super(model, 10, 100)
    }
}

class SampleAppendOnlyRepository extends AppendOnlyRepository<Sample> {}

describe('repository initialization', () => {
    it.each([
        ['CrudRepository', (model: Model<Sample>) => new SampleCrudRepository(model)],
        ['AppendOnlyRepository', (model: Model<Sample>) => new SampleAppendOnlyRepository(model)]
    ])('%s는 Mongoose가 시작한 모델 초기화만 기다린다', async (_name, createRepository) => {
        const init = vi.fn(async () => undefined)
        const createCollection = vi.fn()
        const createIndexes = vi.fn()
        const model = { createCollection, createIndexes, init } as unknown as Model<Sample>
        const repository = createRepository(model)

        await repository.onModuleInit()

        expect(init).toHaveBeenCalledTimes(1)
        expect(createCollection).not.toHaveBeenCalled()
        expect(createIndexes).not.toHaveBeenCalled()
    })
})
