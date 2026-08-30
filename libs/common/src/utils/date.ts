export type DateAddOptions = {
    base?: Temporal.Instant
    days?: number
    hours?: number
    milliseconds?: number
    minutes?: number
    seconds?: number
}

const ISO_UTC_INSTANT = /^(?:[+-]\d{6}|\d{4})-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/
const ISO_PLAIN_DATE = /^(?:[+-]\d{6}|\d{4})-\d{2}-\d{2}$/

export class DateUtil {
    static add({
        base = this.now(),
        days = 0,
        hours = 0,
        milliseconds = 0,
        minutes = 0,
        seconds = 0
    }: DateAddOptions): Temporal.Instant {
        const totalMilliseconds =
            days * 24 * 60 * 60 * 1000 +
            hours * 60 * 60 * 1000 +
            minutes * 60 * 1000 +
            seconds * 1000 +
            milliseconds
        return Temporal.Instant.fromEpochMilliseconds(base.epochMilliseconds + totalMilliseconds)
    }

    static compare(left: Temporal.Instant, right: Temporal.Instant): number {
        return Temporal.Instant.compare(left, right)
    }

    static earliest(instants: readonly Temporal.Instant[]): Temporal.Instant {
        if (instants.length === 0) throw new RangeError('At least one instant is required.')
        return instants.reduce((earliest, instant) =>
            this.isBefore(instant, earliest) ? instant : earliest
        )
    }

    static epoch(): Temporal.Instant {
        return Temporal.Instant.fromEpochMilliseconds(0)
    }

    static fromDate(date: Date): Temporal.Instant {
        return Temporal.Instant.fromEpochMilliseconds(date.getTime())
    }

    static fromISOString(value: string): Temporal.Instant {
        if (!ISO_UTC_INSTANT.test(value)) {
            throw new RangeError('Expected an ISO 8601 UTC instant.')
        }
        return this.toMillisecondPrecision(Temporal.Instant.from(value))
    }

    static instantFromInput(value: Date | string | Temporal.Instant): Temporal.Instant {
        if (value instanceof Temporal.Instant) return this.toMillisecondPrecision(value)
        if (value instanceof Date) return this.fromDate(value)
        return this.fromISOString(value)
    }

    static fromYMD(dateString: string): Temporal.PlainDate {
        if (!/^\d{8}$/.test(dateString)) {
            throw new Error('Invalid date string format. Expected YYYYMMDD.')
        }

        const year = Number(dateString.slice(0, 4))
        const month = Number(dateString.slice(4, 6))
        const day = Number(dateString.slice(6, 8))
        return Temporal.PlainDate.from({ day, month, year }, { overflow: 'reject' })
    }

    static fromYMDHM(dateString: string): Temporal.PlainDateTime {
        if (!/^\d{12}$/.test(dateString)) {
            throw new Error('Invalid date string format. Expected YYYYMMDDHHmm.')
        }

        const year = Number(dateString.slice(0, 4))
        const month = Number(dateString.slice(4, 6))
        const day = Number(dateString.slice(6, 8))
        return Temporal.PlainDateTime.from(
            {
                day,
                hour: Number(dateString.slice(8, 10)),
                minute: Number(dateString.slice(10, 12)),
                month,
                year
            },
            { overflow: 'reject' }
        )
    }

    static isAfter(left: Temporal.Instant, right: Temporal.Instant): boolean {
        return this.compare(left, right) > 0
    }

    static isBefore(left: Temporal.Instant, right: Temporal.Instant): boolean {
        return this.compare(left, right) < 0
    }

    static latest(instants: readonly Temporal.Instant[]): Temporal.Instant {
        if (instants.length === 0) throw new RangeError('At least one instant is required.')
        return instants.reduce((latest, instant) =>
            this.isAfter(instant, latest) ? instant : latest
        )
    }

    /** 저장·전송 정밀도와 일치하도록 현재 시각을 밀리초 단위로 반환한다. */
    static now(): Temporal.Instant {
        return Temporal.Instant.fromEpochMilliseconds(Temporal.Now.instant().epochMilliseconds)
    }

    /** MongoDB BSON Date, JWT, AWS SDK 같은 외부 Date 경계에서만 사용한다. */
    static toDate(instant: Temporal.Instant): Date {
        return new Date(instant.epochMilliseconds)
    }

    static toEpochMilliseconds(instant: Temporal.Instant): number {
        return instant.epochMilliseconds
    }

    static toISOString(instant: Temporal.Instant): string {
        return this.toMillisecondPrecision(instant).toString({ fractionalSecondDigits: 3 })
    }

    static toMillisecondPrecision(instant: Temporal.Instant): Temporal.Instant {
        return Temporal.Instant.fromEpochMilliseconds(instant.epochMilliseconds)
    }

    /** BSON Date로 저장한 날짜 전용 값을 UTC 달력 날짜로 복원한다. */
    static toPlainDate(date: Date): Temporal.PlainDate {
        return Temporal.PlainDate.from({
            day: date.getUTCDate(),
            month: date.getUTCMonth() + 1,
            year: date.getUTCFullYear()
        })
    }

    /** 날짜 전용 값을 BSON Date로 저장하기 위한 UTC 자정 경계 변환이다. */
    static plainDateToDate(date: Temporal.PlainDate): Date {
        const boundary = new Date(0)
        boundary.setUTCFullYear(date.year, date.month - 1, date.day)
        boundary.setUTCHours(0, 0, 0, 0)
        return boundary
    }

    static startOfUtcDay(date: Temporal.PlainDate): Temporal.Instant {
        return this.fromISOString(`${date.toString()}T00:00:00.000Z`)
    }

    static endOfUtcDay(date: Temporal.PlainDate): Temporal.Instant {
        return this.add({ base: this.startOfUtcDay(date), days: 1, milliseconds: -1 })
    }

    static plainDateFromInput(value: Date | string | Temporal.PlainDate): Temporal.PlainDate {
        if (value instanceof Temporal.PlainDate) return value
        if (value instanceof Date) return this.toPlainDate(value)
        if (!ISO_PLAIN_DATE.test(value)) {
            throw new RangeError('Expected an ISO calendar date.')
        }
        return Temporal.PlainDate.from(value)
    }

    static toYMD(date: Temporal.PlainDate | Temporal.PlainDateTime): string {
        if (date.year < 0 || date.year > 9999) {
            throw new RangeError('YYYYMMDD only supports years from 0000 through 9999.')
        }
        return `${date.year.toString().padStart(4, '0')}${date.month
            .toString()
            .padStart(2, '0')}${date.day.toString().padStart(2, '0')}`
    }
}
