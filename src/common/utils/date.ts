import { Exception } from 'common'

export function stringToMillisecs(str: string): number {
    const timeUnits: { [key: string]: number } = {
        ms: 1,
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    }

    // Regular expressions to check for valid time formats
    const validFormatRegex = /^(-?\d+(\.\d+)?)(ms|s|m|h|d)(\s*(-?\d+(\.\d+)?)(ms|s|m|h|d))*$/

    if (!validFormatRegex.test(str)) {
        throw new Exception(`Invalid time format(${str})`)
    }

    const regex = /(-?\d+(\.\d+)?)(ms|s|m|h|d)/g
    let totalMillis = 0

    let match
    while ((match = regex.exec(str)) !== null) {
        const amount = parseFloat(match[1])
        const unit = match[3]

        totalMillis += amount * timeUnits[unit]
    }

    return totalMillis
}

export function millisecsToString(ms: number): string {
    if (ms === 0) {
        return '0ms'
    }

    const negative = ms < 0
    ms = Math.abs(ms)

    const days = Math.floor(ms / (24 * 60 * 60 * 1000))
    ms %= 24 * 60 * 60 * 1000
    const hours = Math.floor(ms / (60 * 60 * 1000))
    ms %= 60 * 60 * 1000
    const minutes = Math.floor(ms / (60 * 1000))
    ms %= 60 * 1000
    const seconds = Math.floor(ms / 1000)
    const milliseconds = ms % 1000

    let result = ''
    if (days > 0) result += `${days}d`
    if (hours > 0) result += `${hours}h`
    if (minutes > 0) result += `${minutes}m`
    if (seconds > 0) result += `${seconds}s`
    if (milliseconds > 0) result += `${milliseconds}ms`

    return (negative ? '-' : '') + result.trim()
}

export function addDays(date: Date, days: number) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60 * 1000)
}

export function findMinDate(dates: Date[]): Date {
    const minTimestamp = Math.min(...dates.map((date) => date.getTime()))
    return new Date(minTimestamp)
}

export function findMaxDate(dates: Date[]): Date {
    const maxTimestamp = Math.max(...dates.map((date) => date.getTime()))
    return new Date(maxTimestamp)
}

export function convertDateToString(date: Date): string {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0') // Make month a 2-digit number
    const day = date.getDate().toString().padStart(2, '0') // Make day a 2-digit number
    return `${year}${month}${day}`
}

export function convertStringToDate(dateString: string): Date {
    if (dateString.length !== 8) {
        throw new Error('Invalid date string format. Expected YYYYMMDD.')
    }
    const year = parseInt(dateString.substring(0, 4), 10)
    const month = parseInt(dateString.substring(4, 6), 10) - 1 // Subtract 1 as months are represented as 0-11
    const day = parseInt(dateString.substring(6, 8), 10)
    return new Date(year, month, day)
}
