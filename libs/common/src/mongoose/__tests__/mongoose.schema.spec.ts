import { Types } from 'mongoose'
import type { MongooseSchemaFixture } from './mongoose.schema.fixture'
import { addDeletedAtFilterToPipeline } from '../mongoose.schema'

describe('Mongoose schema types', () => {
    let fix: MongooseSchemaFixture

    beforeEach(async () => {
        const { createMongooseSchemaFixture } = await import('./mongoose.schema.fixture')
        fix = await createMongooseSchemaFixture()
    })
    afterEach(() => fix.teardown())

    // 기본 Mongoose 데이터 타입을 모두 저장하고 조회한다
    it('stores and retrieves all default Mongoose data types', async () => {
        const doc = new fix.model()
        doc.sn = 1234567
        doc.name = 'Statue of Liberty'
        doc.binary = Buffer.alloc(0)
        doc.living = false
        doc.updated = new Date()
        doc.age = 65
        doc.mixed = { any: { thing: 'i want' } }
        doc.someId = new Types.ObjectId()
        doc.decimal = '123.45' as unknown as Types.Decimal128
        doc.array = [1, 'two', { three: 3 }]
        doc.ofString = ['strings!', 'more strings']
        doc.ofNumber = [1, 2, 3, 4]
        doc.ofDates = [new Date(), new Date(Date.now() - 100000)]
        doc.ofBuffer = [Buffer.from('hello'), Buffer.from('world')]
        doc.ofMixed = [1, 'two', { three: 3 }]
        doc.nested = { stuff: '  Hello World  ' }
        doc.map = new Map<string, any>([
            ['key1', 'value1'],
            ['key2', 2]
        ])
        doc.optional = undefined
        await doc.save()

        const foundDoc = await fix.model.findOne({ _id: doc._id }).exec()
        expect(foundDoc?.toJSON()).toEqual(doc.toJSON())
    })

    describe('addDeletedAtFilterToPipeline', () => {
        // 첫 스테이지가 없을 때
        describe('when the pipeline is empty', () => {
            // deletedAt 필터를 첫 스테이지로 추가한다
            it('adds a deletedAt match as the first stage', () => {
                const pipeline: Record<string, any>[] = []

                addDeletedAtFilterToPipeline(pipeline)

                expect(pipeline).toEqual([{ $match: { deletedAt: null } }])
            })
        })

        // 첫 스테이지가 $geoNear일 때
        describe('when the first stage is $geoNear', () => {
            // deletedAt 필터를 두 번째 스테이지로 추가한다
            it('adds a deletedAt match as the second stage', () => {
                const geoNearStage = {
                    $geoNear: {
                        distanceField: 'd',
                        near: { coordinates: [127, 37], type: 'Point' }
                    }
                }
                const pipeline: Record<string, any>[] = [geoNearStage]

                addDeletedAtFilterToPipeline(pipeline)

                expect(pipeline).toEqual([geoNearStage, { $match: { deletedAt: null } }])
            })
        })

        // 첫 스테이지가 $search일 때
        describe('when the first stage is $search', () => {
            // deletedAt 필터를 두 번째 스테이지로 추가한다
            it('adds a deletedAt match as the second stage', () => {
                const searchStage = {
                    $search: { index: 'default', text: { path: 'name', query: 'a' } }
                }
                const pipeline: Record<string, any>[] = [searchStage]

                addDeletedAtFilterToPipeline(pipeline)

                expect(pipeline).toEqual([searchStage, { $match: { deletedAt: null } }])
            })
        })

        // 첫 스테이지가 $vectorSearch일 때
        describe('when the first stage is $vectorSearch', () => {
            // deletedAt 필터를 두 번째 스테이지로 추가한다
            it('adds a deletedAt match as the second stage', () => {
                const vectorSearchStage = {
                    $vectorSearch: {
                        index: 'v',
                        limit: 3,
                        numCandidates: 10,
                        path: 'embedding',
                        queryVector: [0.1]
                    }
                }
                const pipeline: Record<string, any>[] = [vectorSearchStage]

                addDeletedAtFilterToPipeline(pipeline)

                expect(pipeline).toEqual([vectorSearchStage, { $match: { deletedAt: null } }])
            })
        })
    })
})
