import { newObjectIdString } from '@mannercode/common'
import { nullObjectId, withTestId } from '@mannercode/testing'
import { Client, Connection } from '@temporalio/client'
import { NativeConnection, Worker } from '@temporalio/worker'
import { readFileSync } from 'fs'
import type { ShowtimeCreationEvent, ValidateAndCreateResult } from '../../internal'
import type { LegacyShowtimeCreationWorkflowInput } from '../legacy-types'
import { legacyShowtimeCreationBundle } from '../bundle'

type LegacyWorkflowActivities = {
    compensate: (sagaId: string) => Promise<void>
    emitStatusChanged: (payload: ShowtimeCreationEvent) => Promise<void>
    validateAndCreate: (
        input: LegacyShowtimeCreationWorkflowInput
    ) => Promise<ValidateAndCreateResult>
}

const address = `${process.env.TEMPORAL_HOST}:${process.env.TEMPORAL_PORT}`
const namespace = process.env.TEMPORAL_NAMESPACE as string

describe('legacy showtimeCreationWorkflow', () => {
    let connection: Connection
    let nativeConnection: NativeConnection
    let client: Client
    let bundleCode: string

    beforeAll(async () => {
        connection = await Connection.connect({ address })
        nativeConnection = await NativeConnection.connect({ address })
        client = new Client({ connection, namespace })
        bundleCode = readFileSync(legacyShowtimeCreationBundle.bundlePath, 'utf8')
    }, 60_000)

    afterAll(async () => {
        await connection.close()
        await nativeConnection.close()
    })

    const buildInput = (): LegacyShowtimeCreationWorkflowInput => ({
        createDto: {
            durationInMinutes: 1,
            movieId: nullObjectId,
            startTimes: [new Date('2100-01-01T09:00:00.000Z')],
            theaterIds: [nullObjectId]
        },
        sagaId: newObjectIdString()
    })

    async function runWorkflow(
        input: LegacyShowtimeCreationWorkflowInput,
        activities: LegacyWorkflowActivities
    ) {
        const taskQueue = withTestId('showtime-creation-v1-unit')
        const worker = await Worker.create({
            activities,
            connection: nativeConnection,
            namespace,
            taskQueue,
            workflowBundle: { code: bundleCode }
        })

        await worker.runUntil(
            client.workflow.execute('showtimeCreationWorkflow', {
                args: [input],
                taskQueue,
                workflowId: withTestId('showtime-creation-v1-wf')
            })
        )
    }

    it('기존 성공 command 순서를 보존한다', async () => {
        const timeline: string[] = []
        const input = buildInput()
        const activities: LegacyWorkflowActivities = {
            compensate: jest.fn(async () => {
                timeline.push('compensate')
            }),
            emitStatusChanged: jest.fn(async ({ status }) => {
                timeline.push(`emit:${status}`)
            }),
            validateAndCreate: jest.fn(async (): Promise<ValidateAndCreateResult> => {
                timeline.push('validateAndCreate')
                return { createdShowtimeCount: 1, createdTicketCount: 10, kind: 'succeeded' }
            })
        }

        await runWorkflow(input, activities)

        expect(timeline).toEqual(['emit:processing', 'validateAndCreate', 'emit:succeeded'])
        expect(activities.compensate).not.toHaveBeenCalled()
    })

    it('기존 실패 history처럼 보상 뒤 error를 발행한다', async () => {
        const timeline: string[] = []
        const input = buildInput()
        const activities: LegacyWorkflowActivities = {
            compensate: jest.fn(async () => {
                timeline.push('compensate')
            }),
            emitStatusChanged: jest.fn(async ({ status }) => {
                timeline.push(`emit:${status}`)
            }),
            validateAndCreate: jest.fn(async () => {
                timeline.push('validateAndCreate')
                throw new Error('legacy create failed')
            })
        }

        await runWorkflow(input, activities)

        expect(timeline).toEqual([
            'emit:processing',
            'validateAndCreate',
            'compensate',
            'emit:error'
        ])
        expect(activities.compensate).toHaveBeenCalledWith(input.sagaId)
    })
})
