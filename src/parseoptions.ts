import {
  Options,
  ParsedOptions,
  ByWeekday,
  freqIsDailyOrGreater,
} from './types'
import {
  includes,
  notEmpty,
  isPresent,
  isNumber,
  isArray,
  isWeekdayStr,
  toArray,
} from './helpers'
import { RRule, defaultKeys, DEFAULT_OPTIONS } from './rrule'
import { getWeekday, isDate, isValidDate } from './dateutil'
import { Weekday } from './weekday'
import { Time } from './datetime'

export function initializeOptions(options: Partial<Options>) {
  const invalid: string[] = []
  const keys = Object.keys(options) as (keyof Options)[]

  // Shallow copy for options and origOptions and check for invalid
  for (const key of keys) {
    if (!includes(defaultKeys, key)) invalid.push(key)
    if (isDate(options[key]) && !isValidDate(options[key])) {
      invalid.push(key)
    }
  }

  if (invalid.length) {
    throw new Error('Invalid options: ' + invalid.join(', '))
  }

  return { ...options }
}

export function parseOptions(options: Partial<Options>) {
  const opts = { ...DEFAULT_OPTIONS, ...initializeOptions(options) }

  // Re-parsing an already parsed set of options (e.g. `new RRule(rule.options)`)
  // feeds the internal bynweekday / bynmonthday fields back in. They are not a
  // public input format, so fold them back into the public byweekday /
  // bymonthday options before any normalization takes place.
  rehydrateInternalByRules(opts)

  if (isPresent(opts.byeaster)) opts.freq = RRule.YEARLY

  if (!(isPresent(opts.freq) && RRule.FREQUENCIES[opts.freq])) {
    throw new Error(`Invalid frequency: ${opts.freq} ${options.freq}`)
  }

  if (!opts.dtstart) opts.dtstart = new Date(new Date().setMilliseconds(0))

  if (!isPresent(opts.wkst)) {
    opts.wkst = RRule.MO.weekday
  } else if (isNumber(opts.wkst)) {
    // cool, just keep it like that
  } else {
    opts.wkst = opts.wkst.weekday
  }

  if (isPresent(opts.bysetpos)) {
    if (isNumber(opts.bysetpos)) opts.bysetpos = [opts.bysetpos]

    for (let i = 0; i < opts.bysetpos.length; i++) {
      const v = opts.bysetpos[i]
      if (v === 0 || !(v >= -366 && v <= 366)) {
        throw new Error(
          'bysetpos must be between 1 and 366,' + ' or between -366 and -1'
        )
      }
    }
  }

  if (
    !(
      Boolean(opts.byweekno as number) ||
      notEmpty(opts.byweekno as number[]) ||
      notEmpty(opts.byyearday as number[]) ||
      Boolean(opts.bymonthday) ||
      notEmpty(opts.bymonthday as number[]) ||
      isPresent(opts.byweekday) ||
      isPresent(opts.byeaster)
    )
  ) {
    switch (opts.freq) {
      case RRule.YEARLY:
        if (!opts.bymonth) opts.bymonth = opts.dtstart.getUTCMonth() + 1
        opts.bymonthday = opts.dtstart.getUTCDate()
        break
      case RRule.MONTHLY:
        opts.bymonthday = opts.dtstart.getUTCDate()
        break
      case RRule.WEEKLY:
        opts.byweekday = [getWeekday(opts.dtstart)]
        break
    }
  }

  // bymonth
  if (isPresent(opts.bymonth) && !isArray(opts.bymonth)) {
    opts.bymonth = [opts.bymonth]
  }

  // byyearday
  if (
    isPresent(opts.byyearday) &&
    !isArray(opts.byyearday) &&
    isNumber(opts.byyearday)
  ) {
    opts.byyearday = [opts.byyearday]
  }

  // bymonthday
  if (!isPresent(opts.bymonthday)) {
    opts.bymonthday = []
    opts.bynmonthday = []
  } else if (isArray(opts.bymonthday)) {
    const bymonthday = []
    const bynmonthday = []

    for (let i = 0; i < opts.bymonthday.length; i++) {
      const v = opts.bymonthday[i]
      if (v > 0) {
        bymonthday.push(v)
      } else if (v < 0) {
        bynmonthday.push(v)
      }
    }
    opts.bymonthday = bymonthday
    opts.bynmonthday = bynmonthday
  } else if (opts.bymonthday < 0) {
    opts.bynmonthday = [opts.bymonthday]
    opts.bymonthday = []
  } else {
    opts.bynmonthday = []
    opts.bymonthday = [opts.bymonthday]
  }

  // byweekno
  if (isPresent(opts.byweekno) && !isArray(opts.byweekno)) {
    opts.byweekno = [opts.byweekno]
  }

  // byweekday / bynweekday
  if (!isPresent(opts.byweekday)) {
    opts.bynweekday = null
  } else if (isNumber(opts.byweekday)) {
    opts.byweekday = [opts.byweekday]
    opts.bynweekday = null
  } else if (isWeekdayStr(opts.byweekday)) {
    opts.byweekday = [Weekday.fromStr(opts.byweekday).weekday]
    opts.bynweekday = null
  } else if (opts.byweekday instanceof Weekday) {
    if (!opts.byweekday.n || opts.freq > RRule.MONTHLY) {
      opts.byweekday = [opts.byweekday.weekday]
      opts.bynweekday = null
    } else {
      opts.bynweekday = [[opts.byweekday.weekday, opts.byweekday.n]]
      opts.byweekday = null
    }
  } else {
    const byweekday: number[] = []
    const bynweekday = []

    for (let i = 0; i < opts.byweekday.length; i++) {
      const wday = opts.byweekday[i]

      if (isNumber(wday)) {
        byweekday.push(wday)
        continue
      } else if (isWeekdayStr(wday)) {
        byweekday.push(Weekday.fromStr(wday).weekday)
        continue
      }

      if (!wday.n || opts.freq > RRule.MONTHLY) {
        byweekday.push(wday.weekday)
      } else {
        bynweekday.push([wday.weekday, wday.n])
      }
    }
    opts.byweekday = notEmpty(byweekday) ? byweekday : null
    opts.bynweekday = notEmpty(bynweekday) ? bynweekday : null
  }

  // byhour
  if (!isPresent(opts.byhour)) {
    opts.byhour = opts.freq < RRule.HOURLY ? [opts.dtstart.getUTCHours()] : null
  } else if (isNumber(opts.byhour)) {
    opts.byhour = [opts.byhour]
  }

  // byminute
  if (!isPresent(opts.byminute)) {
    opts.byminute =
      opts.freq < RRule.MINUTELY ? [opts.dtstart.getUTCMinutes()] : null
  } else if (isNumber(opts.byminute)) {
    opts.byminute = [opts.byminute]
  }

  // bysecond
  if (!isPresent(opts.bysecond)) {
    opts.bysecond =
      opts.freq < RRule.SECONDLY ? [opts.dtstart.getUTCSeconds()] : null
  } else if (isNumber(opts.bysecond)) {
    opts.bysecond = [opts.bysecond]
  }

  return { parsedOptions: opts as ParsedOptions }
}

/**
 * Folds the internal bynweekday / bynmonthday fields (only ever produced by
 * parseOptions itself) back into the public byweekday / bymonthday options.
 *
 * This makes passing a parsed `rule.options` object back into `new RRule()` a
 * round trip: the internal fields are not part of the documented input format
 * and would otherwise be silently dropped (taking the ordinal / negative
 * constraints with them) or emitted as non-standard properties.
 */
function rehydrateInternalByRules(opts: Partial<Options>) {
  if (notEmpty(opts.bynmonthday)) {
    const bymonthday: number[] = []

    const push = (v: number) => {
      if (!bymonthday.includes(v)) bymonthday.push(v)
    }

    if (isPresent(opts.bymonthday)) {
      ;(isArray(opts.bymonthday) ? opts.bymonthday : [opts.bymonthday]).forEach(
        push
      )
    }
    opts.bynmonthday.forEach(push)
    opts.bymonthday = bymonthday
  }

  if (notEmpty(opts.bynweekday)) {
    const byweekday: ByWeekday[] = []

    if (isPresent(opts.byweekday)) {
      ;(isArray(opts.byweekday) ? opts.byweekday : [opts.byweekday]).forEach(
        (wday) => byweekday.push(wday)
      )
    }

    for (const [weekday, n] of opts.bynweekday) {
      byweekday.push(new Weekday(weekday, n))
    }

    opts.byweekday = byweekday
  }
}

/**
 * Returns true when the given input options were produced by a previous
 * parseOptions() call (i.e. they carry the internal bynweekday /
 * bynmonthday fields).
 */
export function areParsedOptions(options: Partial<Options>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(options, 'bynweekday') ||
    Object.prototype.hasOwnProperty.call(options, 'bynmonthday')
  )
}

/**
 * Rebuilds the documented, public options shape from an already parsed set of
 * options, so `new RRule(rule.options)` keeps the exact same rule.
 *
 * The internal bynweekday / bynmonthday fields are folded back into
 * byweekday (as Weekday instances) and bymonthday (positive and negative
 * numbers) and then dropped.
 */
export function rehydrateParsedOptions(
  options: Partial<Options>
): Partial<Options> {
  const opts: Partial<Options> = { ...options }
  rehydrateInternalByRules(opts)

  // Plain numeric weekdays (kept as numbers by parseOptions) are normalized
  // into Weekday instances, which is what toText()/optionsToString() expect
  // from a user-supplied byweekday.
  if (isPresent(opts.byweekday)) {
    opts.byweekday = toArray<ByWeekday>(opts.byweekday).map((wday) =>
      typeof wday === 'number' ? new Weekday(wday) : wday
    )
  }

  delete opts.bynweekday
  delete opts.bynmonthday

  return opts
}

export function buildTimeset(opts: ParsedOptions) {
  const millisecondModulo = opts.dtstart.getTime() % 1000
  if (!freqIsDailyOrGreater(opts.freq)) {
    return []
  }

  const timeset: Time[] = []
  opts.byhour.forEach((hour) => {
    opts.byminute.forEach((minute) => {
      opts.bysecond.forEach((second) => {
        timeset.push(new Time(hour, minute, second, millisecondModulo))
      })
    })
  })

  return timeset
}
