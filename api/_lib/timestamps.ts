const WIB_TIME_ZONE = 'Asia/Jakarta'

const WIB_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: WIB_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

type TimestampPart = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'

function timestampPart(
  parts: Intl.DateTimeFormatPart[],
  type: TimestampPart,
): string {
  const value = parts.find((part) => part.type === type)?.value
  if (!value) throw new RangeError(`WIB timestamp is missing ${type}.`)
  return value
}

export function formatWibTimestamp(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Cannot format an invalid Date.')
  }

  const parts = WIB_TIMESTAMP_FORMATTER.formatToParts(date)
  const year = timestampPart(parts, 'year')
  const month = timestampPart(parts, 'month')
  const day = timestampPart(parts, 'day')
  const hour = timestampPart(parts, 'hour')
  const minute = timestampPart(parts, 'minute')
  const second = timestampPart(parts, 'second')

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}
