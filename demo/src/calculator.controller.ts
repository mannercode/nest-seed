import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { MessagePatterns } from './message-patterns.js'

@Controller()
export class CalculatorController {
    @MessagePattern(MessagePatterns.calculator.add)
    add(@Payload() { left, right }: { left: number; right: number }) {
        return left + right
    }
}
