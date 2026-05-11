/**
 * 영화 도메인에서 "필드 미설정" 을 나타내는 값 모음이다. `MoviesService.publish()`
 * 가 영화를 공개로 바꿀 때 각 필드가 여기 값과 같은지 보고, 같으면 "필수
 * 필드 누락" 으로 처리한다.
 *
 * 의도한 한계 한 가지가 있다. 사용자가 정말로 이 값과 같은 입력을 보내면
 * (예: `rating: 'Unrated'`, `releaseDate: '0000-01-01'`, `durationInSeconds: -1`)
 * `publish()` 가 "미설정" 으로 오해해서 거절한다.
 *
 * 이 한계를 풀려면 스키마를 nullable 로 바꾸고 검증을 null 검사로 옮겨야
 * 한다. 그때는 스키마, DTO, 서비스, 통합 테스트를 함께 갱신한다.
 */
export const MovieDefaults = {
    director: '',
    durationInSeconds: -1,
    plot: '',
    rating: 'Unrated',
    releaseDate: new Date('0000-01-01'),
    title: ''
} as const
