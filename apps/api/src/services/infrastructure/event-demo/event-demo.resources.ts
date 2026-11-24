import { sha256 } from '@mannercode/common'

export function eventDemoResources(projectId: string) {
    const resourceId = sha256(projectId, 'hex').slice(0, 24).toUpperCase()
    return {
        streamName: 'DEMO_EVENTS_' + resourceId,
        consumerName: 'DEMO_MESSAGES_' + resourceId,
        subjects: {
            queued: projectId + '.event-demo.queued',
            received: projectId + '.event-demo.received'
        }
    }
}
