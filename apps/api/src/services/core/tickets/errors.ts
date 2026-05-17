export const TicketErrors = {
    StatusTransitionFailed: (ticketIds: string[]) => ({
        code: 'ERR_TICKET_STATUS_TRANSITION_FAILED',
        message: 'Some tickets could not be transitioned (missing or already in the target state).',
        ticketIds
    })
}
