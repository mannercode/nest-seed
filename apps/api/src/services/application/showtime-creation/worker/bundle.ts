import path from 'path'

export const showtimeCreationBundle = {
    sourcePath: path.resolve(__dirname, 'workflow.ts'),
    bundlePath: path.resolve(process.cwd(), '_output/workflows/showtime-creation/workflow.js')
}
