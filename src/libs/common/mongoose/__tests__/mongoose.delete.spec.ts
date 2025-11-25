import { Fixture, HardDeleteSample, SoftDeleteSample } from './mongoose.delete.fixture'

describe('Mongoose Delete', () => {
    describe('Soft Delete', () => {
        let fixture: Fixture<SoftDeleteSample>

        beforeEach(async () => {
            const { createFixture } = await import('./mongoose.delete.fixture')
            fixture = await createFixture(SoftDeleteSample)
        })

        afterEach(async () => {
            await fixture?.teardown()
        })

        // 생성 직후인 경우
        describe('when the document is newly created', () => {
            // TODO fix
            // deletedAt이 null이다
            it('sets deletedAt to null', async () => {
                expect(fixture.doc).toMatchObject({ deletedAt: null })
            })
        })

        // deleteOne을 호출하는 경우
        describe('when deleting with deleteOne', () => {
            // deletedAt에 삭제 시간이 기록된다
            it('records deletedAt with the deletion time', async () => {
                await fixture.model.deleteOne({ _id: fixture.doc._id })

                const foundDoc = await fixture.model
                    .findOne({ _id: { $eq: fixture.doc._id } })
                    .setOptions({ withDeleted: true })
                    .exec()

                expect(foundDoc?.deletedAt).toEqual(expect.any(Date))
            })
        })

        // deleteMany를 호출하는 경우
        describe('when deleting with deleteMany', () => {
            // deletedAt에 삭제 시간이 기록된다
            it('records deletedAt for each document', async () => {
                const doc2 = new fixture.model()
                doc2.name = 'name'
                await doc2.save()

                await fixture.model.deleteMany({ _id: { $in: [fixture.doc._id, doc2._id] } as any })

                const foundDocs = await fixture.model.find({}).setOptions({ withDeleted: true })
                expect(foundDocs[0]).toMatchObject({ deletedAt: expect.any(Date) })
                expect(foundDocs[1]).toMatchObject({ deletedAt: expect.any(Date) })
            })
        })

        // 삭제 후 aggregate를 수행하는 경우
        describe('when aggregating after deletion', () => {
            // 삭제된 문서는 반환하지 않는다
            it('excludes deleted documents from aggregate', async () => {
                await fixture.model.deleteOne({ _id: fixture.doc._id })

                const got = await fixture.model.aggregate([{ $match: { name: 'name' } }])

                expect(got).toHaveLength(0)
            })
        })
    })

    describe('Hard Delete', () => {
        let fixture: Fixture<HardDeleteSample>

        beforeEach(async () => {
            const { createFixture } = await import('./mongoose.delete.fixture')
            fixture = await createFixture(HardDeleteSample)
        })

        afterEach(async () => {
            await fixture?.teardown()
        })

        // 삭제 시
        describe('when deleting a document', () => {
            // 데이터를 완전히 삭제한다
            it('removes the document entirely', async () => {
                expect(fixture.doc).not.toHaveProperty('deletedAt')
            })
        })
    })
})
