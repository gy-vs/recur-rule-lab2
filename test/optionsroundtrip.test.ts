import { RRule, rrulestr } from '../src/index'

const fmt = (d: Date) => d.toISOString().slice(0, 10)
const DTSTART = new Date(Date.UTC(2024, 0, 1, 9, 0, 0))

describe('round-trip rule.options', () => {
  const cases: Array<{
    name: string
    opts: ConstructorParameters<typeof RRule>[0]
    expected: string[]
    archiveRrule: string
    archivePart: string
    textPart: string
  }> = [
    {
      name: 'last Friday monthly',
      opts: {
        freq: RRule.MONTHLY,
        count: 3,
        dtstart: DTSTART,
        byweekday: RRule.FR.nth(-1),
      },
      expected: ['2024-01-26', '2024-02-23', '2024-03-29'],
      archiveRrule: 'RRULE:FREQ=MONTHLY;COUNT=3;BYDAY=-1FR',
      archivePart: 'BYDAY=-1FR',
      textPart: 'last Friday',
    },
    {
      name: 'first and last monthday',
      opts: {
        freq: RRule.MONTHLY,
        count: 3,
        dtstart: DTSTART,
        bymonthday: [1, -1],
      },
      expected: ['2024-01-01', '2024-01-31', '2024-02-01'],
      archiveRrule: 'RRULE:FREQ=MONTHLY;COUNT=3;BYMONTHDAY=1,-1',
      archivePart: 'BYMONTHDAY=1,-1',
      textPart: '1st and last',
    },
    {
      name: 'first Monday and last Friday',
      opts: {
        freq: RRule.MONTHLY,
        count: 4,
        dtstart: DTSTART,
        byweekday: [RRule.MO.nth(1), RRule.FR.nth(-1)],
      },
      expected: ['2024-01-01', '2024-01-26', '2024-02-05', '2024-02-23'],
      archiveRrule: 'RRULE:FREQ=MONTHLY;COUNT=4;BYDAY=+1MO,-1FR',
      archivePart: 'BYDAY=+1MO,-1FR',
      textPart: '1st Monday and last Friday',
    },
    {
      name: '2nd Sunday in March',
      opts: {
        freq: RRule.YEARLY,
        count: 2,
        dtstart: DTSTART,
        bymonth: 3,
        byweekday: RRule.SU.nth(2),
      },
      expected: ['2024-03-10', '2025-03-09'],
      archiveRrule: 'RRULE:FREQ=YEARLY;COUNT=2;BYMONTH=3;BYDAY=+2SU',
      archivePart: 'BYDAY=+2SU',
      textPart: '2nd Sunday',
    },
  ]

  for (const c of cases) {
    describe(c.name, () => {
      const rule = new RRule(c.opts)

      it('produces the expected dates directly', () => {
        expect(rule.all().map(fmt)).toEqual(c.expected)
      })

      it('original toString() is unchanged (uses user-supplied options)', () => {
        expect(rule.toString()).toBe(
          ['DTSTART:20240101T090000Z', c.archiveRrule]
            .filter(Boolean)
            .join('\n')
        )
      })

      it('matches when rebuilt from rule.options', () => {
        // Copy workflow: spread parsed options, tweak count, rebuild.
        const copied = new RRule({ ...rule.options })
        expect(copied.all().map(fmt)).toEqual(c.expected)
        expect(copied.toText()).toContain(c.textPart)
        expect(copied.isFullyConvertibleToText()).toBe(true)
      })

      it('matches after optionsToString + rrulestr', () => {
        const str = RRule.optionsToString(rule.options)
        expect(str).toContain(c.archivePart)
        expect(str).not.toMatch(/BYNWEEKDAY|BYNMONTHDAY/)
        const restored = rrulestr(str) as RRule
        expect(restored.all().map(fmt)).toEqual(c.expected)
      })

      it('archive string from options parses standalone', () => {
        const str = RRule.optionsToString(rule.options)
        expect(() => rrulestr(str)).not.toThrow()
      })
    })
  }

  it('BYDAY ordinal is ignored for WEEKLY or finer', () => {
    // RFC: ordinal in BYDAY has no meaning below MONTHLY; library ignores it.
    const rule = new RRule({
      freq: RRule.WEEKLY,
      count: 2,
      dtstart: DTSTART,
      byweekday: [RRule.MO.nth(3)],
    })
    const copied = new RRule({ ...rule.options })
    expect(copied.all().map(fmt)).toEqual(rule.all().map(fmt))
  })
})
