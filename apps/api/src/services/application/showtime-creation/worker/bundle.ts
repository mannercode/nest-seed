import path from 'path'

export function resolveWorkflowDirectory(
    configuredDirectory: string | undefined,
    cwd: string
): string {
    return configuredDirectory
        ? path.resolve(configuredDirectory)
        : path.resolve(cwd, '_output/workflows')
}

const workflowDirectory = resolveWorkflowDirectory(
    process.env.API_JEST_WORKFLOW_DIRECTORY,
    process.cwd()
)

export const showtimeCreationBundle = {
    sourcePath: path.resolve(__dirname, 'workflow-v2.ts'),
    bundlePath: path.join(workflowDirectory, 'showtime-creation/v2/workflow.js')
}

export const legacyShowtimeCreationBundle = {
    sourcePath: path.resolve(__dirname, 'workflow.ts'),
    bundlePath: path.join(workflowDirectory, 'showtime-creation/v1/workflow.js')
}
