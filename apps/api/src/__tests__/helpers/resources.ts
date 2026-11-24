import { escapeRegExp } from '@mannercode/common'
import { ConfigService } from '@nestjs/config'
import { AppConfigService } from '#config'
import { eventDemoResources } from '../../services/infrastructure/event-demo/event-demo.resources.js'

const scope = 'nest-seed-api-test'
export const projectId = (testId: string) => `project-${scope}-${testId}`
const testProjectPattern = new RegExp(escapeRegExp(projectId('')) + '[A-Za-z0-9_-]+')

export const bucketName = (workerId: string) => `s3bucket-api-w${workerId}`
export const databaseName = (workerId: string) => `mongo-api-w${workerId}`
export const cleanup = {
    bucketPattern: /^s3bucket-api-w\d+$/,
    databasePattern: /^mongo-api-w\d+$/,
    redisKeyPattern: `*${projectId('')}*`,
    redisKeyScope: scope
}

export function testConfig() {
    const values = AppConfigService.schema.parse(process.env)
    return new AppConfigService(new ConfigService(values), values.PROJECT_ID)
}

export function ownsEventStream({ name, subjects }: { name: string; subjects?: string[] }) {
    if (subjects?.length !== 1) return false
    const subject = subjects[0]!
    const project = testProjectPattern.exec(subject)?.[0]
    if (!project) return false
    const event = eventDemoResources(project)
    return name === event.streamName && subject === event.subjects.queued
}
