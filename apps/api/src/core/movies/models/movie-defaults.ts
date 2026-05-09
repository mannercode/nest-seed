/**
 * 영화 도메인의 "필드 미설정" 표시용 sentinel 모음.
 * MoviesService.publish() 가 publish 시점에 각 필드가 sentinel 과 동등한지
 * 검사해 "필수 필드 누락" 으로 처리한다.
 *
 * 한계 (의도된 trade-off): 사용자가 *명시적으로* sentinel 과 같은 값을
 * 보내면 ('rating: Unrated', 'releaseDate: 0000-01-01', 'durationInSeconds: -1' 등)
 * publish() 가 "missing" 으로 오판해 거부한다. 분리하려면 schema 를 nullable
 * 로 바꾸고 publish 검증을 null 검사로 갈아야 한다 — 그 변경이 필요하면
 * schema/DTO/service/integration test 를 함께 갱신.
 */
export const MovieDefaults = {
    director: '',
    durationInSeconds: -1,
    plot: '',
    rating: 'Unrated',
    releaseDate: new Date('0000-01-01'),
    title: ''
} as const
