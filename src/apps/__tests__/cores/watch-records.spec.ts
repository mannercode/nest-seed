import { WatchRecordDto } from 'apps/cores'
import { oid } from 'testlib'
import { buildCreateWatchRecordDto, createWatchRecord } from '../__helpers__'
import type { Fixture } from './watch-records.fixture'

describe('WatchRecordsService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./watch-records.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('createWatchRecord', () => {
        // payload가 유효한 경우
        describe('when payload is valid', () => {
            // 관람 기록을 생성하고 반환한다
            it('creates and returns a watch record', async () => {
                const createDto = buildCreateWatchRecordDto()

                const watchRecord = await fix.watchRecordsService.createWatchRecord(createDto)

                expect(watchRecord).toEqual({ id: expect.any(String), ...createDto })
            })
        })
    })

    describe('searchWatchRecordsPage', () => {
        const customerId = oid(0xa1)
        let watchRecords: WatchRecordDto[]

        beforeEach(async () => {
            watchRecords = await Promise.all([
                createWatchRecord(fix, { customerId }),
                createWatchRecord(fix, { customerId }),
                createWatchRecord(fix, { customerId }),
                createWatchRecord(fix, { customerId })
            ])
        })

        // `customerId`가 제공된 경우
        describe('when `customerId` is provided', () => {
            // 지정한 customerId의 관람 기록 페이지를 반환한다
            it('returns paginated records for the customerId', async () => {
                const pagination = await fix.watchRecordsService.searchWatchRecordsPage({
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
