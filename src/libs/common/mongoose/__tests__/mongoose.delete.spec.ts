import { Fixture, HardDeleteSample, SoftDeleteSample } from './mongoose.delete.fixture'

describe('Mongoose Delete', () => {
    describe('Soft Delete', () => {
        let fix: Fixture<SoftDeleteSample>

        beforeEach(async () => {
            const { createFixture } = await import('./mongoose.delete.fixture')
            fix = await createFixture(SoftDeleteSample)
        })

        afterEach(async () => {
            await fix?.teardown()
        })

        // 생성 직후인 경우
        describe('when the document is newly created', () => {
            // deletedAt이 null이다
            it('sets deletedAt to null', async () => {
                expect(fix.doc).toMatchObject({ deletedAt: null })
            })
        })

        // deleteOne을 호출하는 경우
        describe('when deleting with deleteOne', () => {
            // deletedAt에 삭제 시간이 기록된다
            it('records deletedAt with the deletion time', async () => {
                await fix.model.deleteOne({ _id: fix.doc._id })

                const found = await fix.model
                    .findOne({ _id: { $eq: fix.doc._id } })
                    .setOptions({ withDeleted: true })
                    .exec()

                expect(found?.deletedAt).toEqual(expect.any(Date))
            })
        })

        // deleteMany를 호출하는 경우
        describe('when deleting with deleteMany', () => {
            // deletedAt에 삭제 시간이 기록된다
            it('records deletedAt for each document', async () => {
                const doc2 = new fix.model()
                doc2.name = 'name'
                await doc2.save()

                await fix.model.deleteMany({ _id: { $in: [fix.doc._id, doc2._id] } as any })

                const found = await fix.model.find({}).setOptions({ withDeleted: true })
                expect(found[0]).toMatchObject({ deletedAt: expect.any(Date) })
                expect(found[1]).toMatchObject({ deletedAt: expect.any(Date) })
            })
        })

        // 삭제 후 aggregate를 수행하는 경우
        describe('when aggregating after deletion', () => {
            // 삭제된 문서는 반환하지 않는다
            it('excludes deleted documents from aggregate', async () => {
                await fix.model.deleteOne({ _id: fix.doc._id })

                const got = await fix.model.aggregate([{ $match: { name: 'name' } }])

                expect(got).toHaveLength(0)
            })
        })
    })

    describe('Hard Delete', () => {
        let fix: Fixture<HardDeleteSample>

        beforeEach(async () => {
            const { createFixture } = await import('./mongoose.delete.fixture')
            fix = await createFixture(HardDeleteSample)
        })

        afterEach(async () => {
            await fix?.teardown()
        })

        // 삭제 시
        describe('when deleting a document', () => {
            // 데이터를 완전히 삭제한다
            it('removes the document entirely', async () => {
                expect(fix.doc).not.toHaveProperty('deletedAt')
            })
        })
    })
})
