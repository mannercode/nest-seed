import { proxyActivities } from '@temporalio/workflow'

const activities = proxyActivities<{ greet: (name: string) => Promise<string> }>({
    startToCloseTimeout: '10s'
})

export async function greetWorkflow(name: string): Promise<string> {
    return activities.greet(name)
}
