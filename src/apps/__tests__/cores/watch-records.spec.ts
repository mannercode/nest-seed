import { WatchRecordDto } from 'apps/cores'
import { oid } from 'testlib'
import { buildCreateWatchRecordDto, createWatchRecord } from '../__helpers__'
import type { Fixture } from './watch-records.fixture'

describe('WatchRecordsService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./watch-records.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('create', () => {
        // payload가 유효한 경우
        describe('when payload is valid', () => {
            // 관람 기록을 생성하고 반환한다
            it('creates and returns a watch record', async () => {
                const createDto = buildCreateWatchRecordDto()

                const watchRecord = await fixture.watchRecordsService.create(createDto)

                expect(watchRecord).toEqual({ id: expect.any(String), ...createDto })
            })
        })
    })

    describe('searchPage', () => {
        const customerId = oid(0xa1)
        let watchRecords: WatchRecordDto[]

        beforeEach(async () => {
            watchRecords = await Promise.all([
                createWatchRecord(fixture, { customerId }),
                createWatchRecord(fixture, { customerId }),
                createWatchRecord(fixture, { customerId }),
                createWatchRecord(fixture, { customerId })
            ])
        })

        // `customerId`가 제공된 경우
        describe('when `customerId` is provided', () => {
            // 지정한 customerId의 관람 기록 페이지를 반환한다
            it('returns paginated records for the customerId', async () => {
                const pagination = await fixture.watchRecordsService.searchPage({
                    customerId
                })

                expect(pagination).toEqual({
                    skip: 0,
                    take: expect.any(Number),
                    total: watchRecords.length,
                    items: expect.arrayContaining(watchRecords)
                })
            })
        })
    })
})
