import { Options } from '../src/types'
import { RRule } from '../src/rrule'
import { optionsToString } from '../src/optionstostring'
import { datetime } from './lib/utils'

describe('optionsToString', () => {
  it('serializes valid single lines of rrules', function () {
    const expectations: [Partial<Options>, string][] = [
      [
        { freq: RRule.WEEKLY, until: datetime(2010, 1, 1, 0, 0, 0) },
        'RRULE:FREQ=WEEKLY;UNTIL=20100101T000000Z',
      ],
      [
        {
          dtstart: datetime(1997, 9, 2, 9, 0, 0),
          tzid: 'America/New_York',
        },
        'DTSTART;TZID=America/New_York:19970902T090000',
      ],
      [
        {
          dtstart: datetime(1997, 9, 2, 9, 0, 0),
          freq: RRule.WEEKLY,
        },
        'DTSTART:19970902T090000Z\n' + 'RRULE:FREQ=WEEKLY',
      ],
      [
        {
          dtstart: datetime(1997, 9, 2, 9, 0, 0),
          tzid: 'America/New_York',
          freq: RRule.WEEKLY,
        },
        'DTSTART;TZID=America/New_York:19970902T090000\n' + 'RRULE:FREQ=WEEKLY',
      ],
    ]

    expectations.forEach(function (item) {
      const s = item[0]
      const s2 = item[1]
      // JSON.stringify(s)
      expect(optionsToString(s)).toEqual(s2)
    })
  })

  describe('with processed options (rule.options)', () => {
    it('serializes ordinal weekdays as a standard BYDAY property', () => {
      const rule = new RRule({
        freq: RRule.MONTHLY,
        dtstart: datetime(2024, 1, 1, 9, 0, 0),
        count: 3,
        byweekday: [RRule.FR.nth(-1)],
      })

      expect(optionsToString(rule.options)).toEqual(
        'DTSTART:20240101T090000Z\n' +
          'RRULE:FREQ=MONTHLY;INTERVAL=1;WKST=MO;COUNT=3;BYDAY=-1FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0'
      )
    })

    it('serializes negative month days as a standard BYMONTHDAY property', () => {
      const rule = new RRule({
        freq: RRule.MONTHLY,
        dtstart: datetime(2024, 1, 1, 9, 0, 0),
        count: 3,
        bymonthday: [1, -1],
      })

      expect(optionsToString(rule.options)).toEqual(
        'DTSTART:20240101T090000Z\n' +
          'RRULE:FREQ=MONTHLY;INTERVAL=1;WKST=MO;COUNT=3;BYMONTHDAY=1,-1;BYHOUR=9;BYMINUTE=0;BYSECOND=0'
      )
    })

    it('merges plain and ordinal weekdays into a single BYDAY property', () => {
      const rule = new RRule({
        freq: RRule.MONTHLY,
        dtstart: datetime(2024, 1, 1, 9, 0, 0),
        count: 3,
        byweekday: [RRule.MO, RRule.FR.nth(-1)],
      })

      expect(optionsToString(rule.options)).toContain('BYDAY=MO,-1FR')
      expect(optionsToString(rule.options)).not.toContain('BYNWEEKDAY')
    })

    it('does not modify the passed options', () => {
      const rule = new RRule({
        freq: RRule.MONTHLY,
        dtstart: datetime(2024, 1, 1, 9, 0, 0),
        count: 3,
        byweekday: [RRule.FR.nth(-1)],
        bymonthday: [1, -1],
      })

      optionsToString(rule.options)

      expect(rule.options.byweekday).toBeNull()
      expect(rule.options.bynweekday).toEqual([[4, -1]])
      expect(rule.options.bymonthday).toEqual([1])
      expect(rule.options.bynmonthday).toEqual([-1])
    })
  })
})
