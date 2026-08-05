// v1 Temporal history의 wire shape를 동결한다. DTO가 바뀌어도 drain worker 계약은 유지한다.
export type LegacyShowtimeCreationWorkflowInput = {
    createDto: {
        durationInMinutes: number
        movieId: string
        startTimes: Date[]
        theaterIds: string[]
    }
    sagaId: string
}
