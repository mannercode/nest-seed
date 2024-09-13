import { expect } from '@jest/globals'
import { maps, pickItems } from 'common'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import {
    createFixture,
    createSamples,
    SampleDto,
    SamplesRepository
} from './mongoose.repository.fixture'

describe('MongooseRepository - withTransaction', () => {
    let mongod: MongoMemoryReplSet
    let repository: SamplesRepository
    let close: () => void

    beforeAll(async () => {
        mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    }, 60000)

    afterAll(async () => {
        await mongod.stop()
    })

    beforeEach(async () => {
        const fixture = await createFixture(mongod.getUri())
        repository = fixture.repository
        close = fixture.close
    })

    afterEach(async () => {
        await close()
    })

    it('commit a transaction', async () => {
        const docs = await repository.withTransaction(async (session) => {
            const docs = [
                { name: 'document-1' },
                { name: 'document-2' },
                { name: 'document-2' }
            ].map((data) => {
                const doc = repository.newDocument()
                doc.name = data.name
                return doc
            })

            await repository.saveAll(docs, session)
            return docs
        })

        const foundSamples = await repository.findByIds(pickItems(docs, '_id'))
        expect(maps(foundSamples, SampleDto)).toEqual(maps(docs, SampleDto))
    })

    it('should rollback changes when an exception occurs during a transaction', async () => {
        const promise = repository.withTransaction(async (session) => {
            const docs = [
                { name: 'document-1' },
                { name: 'document-2' },
                { name: 'document-2' }
            ].map((data) => {
                const doc = repository.newDocument()
                doc.name = data.name
                return doc
            })

            await repository.saveAll(docs, session)
            throw new Error('')
        })

        await expect(promise).rejects.toThrowError()

        const foundSamples = await repository.findWithPagination()
        expect(foundSamples.total).toEqual(0)
    })

    it('rollback a transaction', async () => {
        const samples = await createSamples(repository)
        const ids = pickItems(samples, '_id')

        await repository.withTransaction(async (session, rollback) => {
            await repository.deleteByIds(ids, session)
            rollback()
        })

        const foundSamples = await repository.findByIds(ids)
        expect(maps(foundSamples, SampleDto)).toEqual(maps(samples, SampleDto))
    })
})
