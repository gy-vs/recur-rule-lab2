import { Options } from './types'
import { RRule, DEFAULT_OPTIONS } from './rrule'
import { includes, isPresent, isArray, isNumber, toArray } from './helpers'
import { Weekday } from './weekday'
import { timeToUntilString } from './dateutil'
import { DateWithZone } from './datewithzone'

export function optionsToString(options: Partial<Options>) {
  const rrule: string[][] = []
  let dtstart = ''
  const keys: (keyof Options)[] = Object.keys(options) as (keyof Options)[]
  const defaultKeys = Object.keys(DEFAULT_OPTIONS)

  for (let i = 0; i < keys.length; i++) {
    if (keys[i] === 'tzid') continue
    if (!includes(defaultKeys, keys[i])) continue

    let key = keys[i].toUpperCase()
    const value = options[keys[i]]
    let outValue = ''

    if (!isPresent(value) || (isArray(value) && !value.length)) continue

    switch (key) {
      case 'FREQ':
        outValue = RRule.FREQUENCIES[options.freq]
        break
      case 'WKST':
        if (isNumber(value)) {
          outValue = new Weekday(value).toString()
        } else {
          outValue = value.toString()
        }
        break
      case 'BYWEEKDAY':
        /*
          NOTE: BYWEEKDAY is a special case.
          RRule() deconstructs the rule.options.byweekday array
          into an array of Weekday arguments.
          On the other hand, rule.origOptions is an array of Weekdays.
          We need to handle both cases here.
          It might be worth change RRule to keep the Weekdays.

          Also, BYWEEKDAY (used by RRule) vs. BYDAY (RFC)

          */
        key = 'BYDAY'
        outValue = toArray<Weekday | number[] | number>(
          value as Weekday | number[] | number
        )
          .map((wday) => {
            if (wday instanceof Weekday) {
              return wday
            }

            if (isArray(wday)) {
              return new Weekday(wday[0], wday[1])
            }

            return new Weekday(wday)
          })
          .toString()

        break
      case 'BYNWEEKDAY':
        // Internal, parsed-only field: merge into the standard BYDAY property
        // instead of emitting the non-standard BYNWEEKDAY name.
        rrule.push([
          'BYDAY',
          (value as number[][])
            .map(([wday, n]) => new Weekday(wday, n))
            .toString(),
        ])
        continue
      case 'BYNMONTHDAY':
        // Internal, parsed-only field: merge into the standard BYMONTHDAY
        // property instead of emitting the non-standard BYNMONTHDAY name.
        if (
          isPresent(options.bymonthday) &&
          notEmptyMonthday(options.bymonthday)
        ) {
          continue
        }
        rrule.push([
          'BYMONTHDAY',
          toArray<number>(value as number[]).toString(),
        ])
        continue
      case 'BYMONTHDAY':
        // Combine any negative days kept in the internal bynmonthday field
        // with the public (positive) bymonthday values.
        outValue = toArray<number>(value as number[])
          .concat(toArray<number>(options.bynmonthday ?? []))
          .toString()
        break

      case 'DTSTART':
        dtstart = buildDtstart(value as number, options.tzid)
        break

      case 'UNTIL':
        outValue = timeToUntilString(value as number, !options.tzid)
        break

      default:
        if (isArray(value)) {
          const strValues: string[] = []
          for (let j = 0; j < value.length; j++) {
            strValues[j] = String(value[j])
          }
          outValue = strValues.toString()
        } else {
          outValue = String(value)
        }
    }

    if (outValue) {
      rrule.push([key, outValue])
    }
  }

  const rules = rrule
    .map(([key, value]) => `${key}=${value.toString()}`)
    .join(';')
  let ruleString = ''
  if (rules !== '') {
    ruleString = `RRULE:${rules}`
  }

  return [dtstart, ruleString].filter((x) => !!x).join('\n')
}

function notEmptyMonthday(value: number | number[] | null) {
  return isPresent(value) && (isArray(value) ? value.length > 0 : true)
}

function buildDtstart(dtstart?: number, tzid?: string | null) {
  if (!dtstart) {
    return ''
  }

  return 'DTSTART' + new DateWithZone(new Date(dtstart), tzid).toString()
}
