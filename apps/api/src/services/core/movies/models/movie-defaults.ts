// publish는 이 sentinel 값들을 미설정으로 본다. 실제 값과 구분하려면 스키마를 nullable로 바꿔야 한다.
export const MovieDefaults = {
    director: '',
    durationInSeconds: -1,
    plot: '',
    rating: 'Unrated',
    releaseDate: new Date('0000-01-01'),
    title: ''
} as const
