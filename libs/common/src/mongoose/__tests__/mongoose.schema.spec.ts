import { expect } from '@jest/globals'
import { Type } from '@nestjs/common'
import { HydratedDocument, Model } from 'mongoose'
import { HttpTestContext } from 'testlib'
import { createMongooseSchema } from '../mongoose.schema'
import { createFixture, HardDeleteSample, SoftDeleteSample } from './mongoose.schema.fixture'

// TODO mongoose의 기능들 테스트 해야 한다. 스키마의 각 타입들 포함
describe('MongooseSchema', () => {
    let testContext: HttpTestContext
    let model: Model<any>
    let doc: HydratedDocument<SoftDeleteSample>

    const createModel = async <T>(cls: Type<T>) => {
        const SampleSchema = createMongooseSchema(cls)
        const fixture = await createFixture(SampleSchema)
        testContext = fixture.testContext
        model = fixture.model

        doc = new model()
        doc.name = 'name'
        await doc.save()
    }

    afterEach(async () => await testContext?.close())

    describe('Soft Delete', () => {
        beforeEach(async () => await createModel(SoftDeleteSample))

        it('deletedAt의 초기값은 null이다', async () => {
            expect(doc).toMatchObject({ deletedAt: null })
        })

        it('deleteOne으로 삭제하면 삭제된 시간이 deletedAt에 기록되어야 한다', async () => {
            await model.deleteOne({ _id: doc._id })

            const found = await model
                .findOne({ _id: { $eq: doc._id } })
                .setOptions({ withDeleted: true })
                .exec()

            expect(found.deletedAt).toEqual(expect.any(Date))
        })

        it('deleteMany로 삭제하면 삭제된 시간이 deletedAt에 기록되어야 한다', async () => {
            const doc2 = new model()
            doc2.name = 'name'
            await doc2.save()

            await model.deleteMany({ _id: { $in: [doc._id, doc2._id] } as any })

            const found = await model.find({}).setOptions({ withDeleted: true })
            expect(found[0]).toMatchObject({ deletedAt: expect.any(Date) })
            expect(found[1]).toMatchObject({ deletedAt: expect.any(Date) })
        })

        it('삭제된 문서는 aggregate에서 검색되지 않아야 한다', async () => {
            await model.deleteOne({ _id: doc._id })

            const got = await model.aggregate([{ $match: { name: 'name' } }])

            expect(got).toHaveLength(0)
        })
    })

    describe('Hard Delete', () => {
        beforeEach(async () => await createModel(HardDeleteSample))

        it('@HardDelete()를 지정하면 데이터를 완전히 삭제해야 한다', async () => {
            expect(doc).not.toHaveProperty('deletedAt')
        })
    })
})
