import type { WatchRecordDto, WatchRecordsService } from 'core'
import { ensure } from '@mannercode/common'
import { oid } from '@mannercode/testing'
import { buildCreateWatchRecordDto, createWatchRecord, type AppTestContext } from '../helpers'

describe('WatchRecordsService', () => {
    let fix: AppTestContext
    let watchRecordsService: WatchRecordsService

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        const { WatchRecordsService } = await import('core')
        fix = await createAppTestContext()
        watchRecordsService = fix.module.get(WatchRecordsService)
    })
    afterEach(() => fix.teardown())

    describe('create', () => {
        it('생성된 시청 기록을 반환한다', async () => {
            const createDto = buildCreateWatchRecordDto()
            const watchRecord = await watchRecordsService.create(createDto)

            expect(watchRecord).toEqual({ ...createDto, id: expect.any(String) })
        })
    })

    describe('searchPage', () => {
        const userId = oid(0xa1)
        let watchRecords: WatchRecordDto[]

        beforeEach(async () => {
            watchRecords = await Promise.all([
                createWatchRecord(fix, { userId }),
                createWatchRecord(fix, { userId }),
                createWatchRecord(fix, {}),
                createWatchRecord(fix, {})
            ])
        })

        const buildExpectedPage = (expectedRecords: WatchRecordDto[]) => ({
            items: expect.arrayContaining(expectedRecords),
            page: expect.any(Number),
            size: expect.any(Number),
            total: expectedRecords.length
        })

        it('userId가 일치하는 기록만 반환한다', async () => {
            const recordsPage = await watchRecordsService.searchPage({ userId })

            expect(recordsPage.items).toHaveLength(2)
            expect(recordsPage).toEqual(
                buildExpectedPage([ensure(watchRecords[0]), ensure(watchRecords[1])])
            )
        })
    })
})
