import path from 'path'

export const showtimeCreationBundle = {
    sourcePath: path.resolve(__dirname, 'workflow-v2.ts'),
    bundlePath: path.resolve(process.cwd(), '_output/workflows/showtime-creation/v2/workflow.js')
}

export const legacyShowtimeCreationBundle = {
    sourcePath: path.resolve(__dirname, 'workflow.ts'),
    bundlePath: path.resolve(process.cwd(), '_output/workflows/showtime-creation/v1/workflow.js')
}
