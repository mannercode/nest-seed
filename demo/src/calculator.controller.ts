import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { MessagePatterns } from './message-patterns.js'

// HTTP Controller처럼 보이지만, 여기서는 HTTP route가 아니라 NATS 메시지를 처리한다.
@Controller()
export class CalculatorController {
    // 클래스가 정의되는 순간 데코레이터가 실행되어 이 메서드에 pattern 메타데이터를 붙인다.
    // 즉, 메시지가 도착할 때 process.env를 다시 읽는 구조가 아니다.
    @MessagePattern(MessagePatterns.calculator.add)

    // @Payload()는 NATS 메시지 전체가 아니라 Nest가 역직렬화한 data 부분을 받는다.
    // 메서드 반환값은 Nest NATS transport가 요청을 보낸 client에게 응답으로 돌려준다.
    add(@Payload() { left, right }: { left: number; right: number }) {
        return left + right
    }
}
