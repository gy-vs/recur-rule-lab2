import { parseOptions } from '../src/parseoptions'
import { RRule } from '../src'

describe('TZID', () => {
  it('leaves null when null', () => {
    const options = parseOptions({ tzid: null })
    expect(options.parsedOptions.tzid).toBeNull()
  })

  it('uses a string when passed in', () => {
    const options = parseOptions({ tzid: 'America/Los_Angeles' })
    expect(options.parsedOptions.tzid).toBe('America/Los_Angeles')
  })
})

describe('byweekday', () => {
  it('works with a single numeric day', () => {
    const options = parseOptions({ byweekday: 1 })
    expect(options.parsedOptions.byweekday).toEqual([1])
  })

  it('works with a single Weekday day', () => {
    const options = parseOptions({ byweekday: RRule.TU })
    expect(options.parsedOptions.byweekday).toEqual([1])
  })

  it('works with a single string day', () => {
    const options = parseOptions({ byweekday: 'TU' })
    expect(options.parsedOptions.byweekday).toEqual([1])
  })

  it('works with a multiple numeric days', () => {
    const options = parseOptions({ byweekday: [1, 2] })
    expect(options.parsedOptions.byweekday).toEqual([1, 2])
  })

  it('works with a multiple Weekday days', () => {
    const options = parseOptions({ byweekday: [RRule.TU, RRule.WE] })
    expect(options.parsedOptions.byweekday).toEqual([1, 2])
  })

  it('works with a multiple string days', () => {
    const options = parseOptions({ byweekday: ['TU', 'WE'] })
    expect(options.parsedOptions.byweekday).toEqual([1, 2])
  })

  it('still ignores ordinals for WEEKLY and more frequent rules', () => {
    const options = parseOptions({
      freq: RRule.WEEKLY,
      byweekday: [RRule.MO.nth(2)],
    })
    expect(options.parsedOptions.byweekday).toEqual([0])
    expect(options.parsedOptions.bynweekday).toBeNull()
  })
})

describe('re-parsing processed options', () => {
  it('keeps ordinal weekdays stored in bynweekday', () => {
    const { parsedOptions } = parseOptions({
      freq: RRule.MONTHLY,
      dtstart: new Date(Date.UTC(2024, 0, 1, 9)),
      byweekday: [RRule.FR.nth(-1)],
    })
    expect(parsedOptions.byweekday).toBeNull()
    expect(parsedOptions.bynweekday).toEqual([[4, -1]])

    const reparsed = parseOptions(parsedOptions).parsedOptions
    expect(reparsed.byweekday).toBeNull()
    expect(reparsed.bynweekday).toEqual([[4, -1]])
  })

  it('keeps negative month days stored in bynmonthday', () => {
    const { parsedOptions } = parseOptions({
      freq: RRule.MONTHLY,
      dtstart: new Date(Date.UTC(2024, 0, 1, 9)),
      bymonthday: [1, -1],
    })
    expect(parsedOptions.bymonthday).toEqual([1])
    expect(parsedOptions.bynmonthday).toEqual([-1])

    const reparsed = parseOptions(parsedOptions).parsedOptions
    expect(reparsed.bymonthday).toEqual([1])
    expect(reparsed.bynmonthday).toEqual([-1])
  })

  it('merges byweekday with an existing bynweekday', () => {
    const { parsedOptions } = parseOptions({
      freq: RRule.MONTHLY,
      dtstart: new Date(Date.UTC(2024, 0, 1, 9)),
      byweekday: [RRule.MO, RRule.FR.nth(-1)],
    })
    expect(parsedOptions.byweekday).toEqual([0])
    expect(parsedOptions.bynweekday).toEqual([[4, -1]])

    const reparsed = parseOptions(parsedOptions).parsedOptions
    expect(reparsed.byweekday).toEqual([0])
    expect(reparsed.bynweekday).toEqual([[4, -1]])
  })

  it('does not fill in defaults when only bynweekday is given', () => {
    const { parsedOptions } = parseOptions({
      freq: RRule.MONTHLY,
      dtstart: new Date(Date.UTC(2024, 0, 1, 9)),
      bynweekday: [[4, -1]],
    })
    expect(parsedOptions.bymonthday).toEqual([])
    expect(parsedOptions.bynweekday).toEqual([[4, -1]])
  })
})
