// 이 코드는 함수 안이 아니라 모듈 최상위에서 실행된다. ESM 모듈은 처음 import될 때
// 한 번 평가된 뒤 캐시되므로, 같은 모듈 그래프에서는 namespace도 한 번만 정해진다.
const namespace = process.env.MESSAGE_NAMESPACE

// @MessagePattern에 잘못된 subject가 조용히 등록되는 것보다 시작 즉시 실패하는 편이 낫다.
// 따라서 setup.ts 또는 실제 애플리케이션 부트스트랩이 import 전에 값을 넣어야 한다.
if (!namespace) {
    throw new Error('MESSAGE_NAMESPACE must be set before application modules are imported.')
}

// NATS에서 "pattern"은 메시지를 주고받는 subject 이름으로 사용된다.
// 객체 한 곳에 모아 두면 송신자와 수신자가 동일한 문자열을 공유할 수 있다.
export const MessagePatterns = {
    calculator: { add: `${namespace}.message.calculator.add` }
    // as const는 속성을 readonly literal 타입으로 보존한다. 런타임 동작에는 영향이 없다.
} as const
