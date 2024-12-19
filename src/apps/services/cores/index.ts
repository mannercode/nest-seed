export * from './customers'
export * from './movies'
export * from './purchases'
export * from './showtimes'
export * from './theaters'
export * from './ticket-holding'
export * from './tickets'
export * from './watch-records'

// export * 은 안티 패턴이라고 한다.
// 여기서 export *을 하는 것은 의도한 것이다.
// 이렇게 하면 순환 참조를 쉽게 발견할 수 있다.
// applications,cores,infrastructures 에서는 각각 index.ts를 둔다
