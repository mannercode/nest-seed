import { workflow, CancelledError, TerminalError } from '@restatedev/restate-sdk'
import { TemporalJsonSerde } from './temporal-json.serde.js'

export type WorkflowStepRetry = {
    initialRetryInterval?: number
    maxRetryAttempts?: number
    maxRetryDuration?: number
}

export type DurableWorkflowContext = {
    run: <T>(name: string, operation: () => Promise<T>, retry: WorkflowStepRetry) => Promise<T>
    attemptSignal: () => AbortSignal
}

export function isWorkflowCancellation(error: unknown): boolean {
    return error instanceof CancelledError
}

export function defineWorkflow<Input, Output>(definition: {
    name: string
    run: (context: DurableWorkflowContext, input: Input) => Promise<Output>
    options: {
        abortTimeout: number
        inactivityTimeout: number
        workflowRetention: number
        terminalError?: (error: unknown) => { message: string; errorCode: number } | undefined
    }
}) {
    const { terminalError, ...options } = definition.options
    return workflow({
        name: definition.name,
        handlers: {
            run: (context, input: Input) =>
                definition.run(
                    {
                        run: (name, operation, retry) => context.run(name, operation, retry),
                        attemptSignal: () => context.request().attemptCompletedSignal
                    },
                    input
                )
        },
        options: {
            ...options,
            serde: TemporalJsonSerde,
            asTerminalError:
                terminalError &&
                ((error: unknown) => {
                    const terminal = terminalError(error)
                    return terminal
                        ? new TerminalError(terminal.message, { errorCode: terminal.errorCode })
                        : undefined
                })
        }
    })
}

export type DurableWorkflowDefinition<Input, Output> = ReturnType<
    typeof defineWorkflow<Input, Output>
>
