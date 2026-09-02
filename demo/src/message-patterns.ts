const namespace = process.env.MESSAGE_NAMESPACE

if (!namespace) {
    throw new Error('MESSAGE_NAMESPACE must be set before application modules are imported.')
}

export const MessagePatterns = {
    calculator: { add: `${namespace}.message.calculator.add` }
} as const
