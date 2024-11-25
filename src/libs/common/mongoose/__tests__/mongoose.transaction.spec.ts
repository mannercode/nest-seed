import { expect } from '@jest/globals'
import { ObjectId, pickIds, toDtos } from 'common'
import { getMongoTestConnection } from 'testlib'
import {
    createFixture,
    createSamples,
    SampleDto,
    SamplesRepository
} from './mongoose.repository.fixture'

describe('MongooseRepository - withTransaction', () => {
    let repository: SamplesRepository
    let close: () => void

    beforeEach(async () => {
        const uri = getMongoTestConnection()

        const fixture = await createFixture(uri)
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
                doc.objId = new ObjectId()
                return doc
            })

            await repository.saveAll(docs, session)
            return docs
        })

        const foundSamples = await repository.findByIds(pickIds(docs))
        expect(toDtos(foundSamples, SampleDto)).toEqual(toDtos(docs, SampleDto))
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
                doc.objId = new ObjectId()
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
        const ids = pickIds(samples)

        await repository.withTransaction(async (session, rollback) => {
            await repository.deleteByIds(ids, session)
            rollback()
        })

        const foundSamples = await repository.findByIds(ids)
        expect(toDtos(foundSamples, SampleDto)).toEqual(toDtos(samples, SampleDto))
    })
})
