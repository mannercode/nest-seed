import { proxyActivities } from '@temporalio/workflow'

const { echo } = proxyActivities<{ echo: (msg: string) => Promise<string> }>({
    startToCloseTimeout: '10 seconds'
})

export async function echoWorkflow(message: string): Promise<string> {
    return echo(message)
}
