const calendar = require('../services/calendar');

describe('calendar service', () => {
  test('normalizeEvent maps timed events', () => {
    const result = calendar.normalizeEvent({
      id: 'evt-1',
      summary: 'Standup',
      location: 'Remote',
      start: { dateTime: '2026-07-14T09:00:00+01:00' },
      end: { dateTime: '2026-07-14T09:30:00+01:00' },
    });

    expect(result.id).toBe('evt-1');
    expect(result.title).toBe('Standup');
    expect(result.location).toBe('Remote');
    expect(result.allDay).toBe(false);
    expect(result.time).toMatch(/^\d{2}:\d{2}$/);
    expect(result.endTime).toMatch(/^\d{2}:\d{2}$/);
    expect(typeof result.startMs).toBe('number');
    expect(Number.isNaN(result.startMs)).toBe(false);
  });

  test('normalizeEvent maps all-day events', () => {
    const result = calendar.normalizeEvent({
      id: 'evt-2',
      summary: 'Holiday',
      start: { date: '2026-07-14' },
      end: { date: '2026-07-15' },
    });

    expect(result.allDay).toBe(true);
    expect(result.time).toBe('All day');
    expect(result.endTime).toBeNull();
    expect(result.title).toBe('Holiday');
    expect(typeof result.startMs).toBe('number');
  });

  test('normalizeEvent uses fallback title when summary missing', () => {
    const result = calendar.normalizeEvent({
      id: 'evt-3',
      start: { dateTime: '2026-07-14T10:00:00Z' },
      end: { dateTime: '2026-07-14T11:00:00Z' },
    });

    expect(result.title).toBe('(No title)');
    expect(result.location).toBe('');
  });

  test('getUpcomingEvents throws when Google env is missing', async () => {
    const envKeys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'];
    const saved = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    envKeys.forEach((key) => {
      delete process.env[key];
    });

    try {
      await expect(calendar.getUpcomingEvents({ days: 1 })).rejects.toMatchObject({
        code: 'CALENDAR_NOT_CONFIGURED',
      });
    } finally {
      envKeys.forEach((key) => {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
      });
    }
  });

  test('getUpcomingEvents lists and normalizes via injected calendar client', async () => {
    const list = jest.fn().mockResolvedValue({
      data: {
        items: [
          {
            id: 'evt-1',
            summary: 'Standup',
            location: 'Room A',
            start: { dateTime: '2026-07-14T09:00:00Z' },
            end: { dateTime: '2026-07-14T09:30:00Z' },
          },
        ],
      },
    });

    const events = await calendar.getUpcomingEvents({
      days: 1,
      calendarClient: { events: { list } },
    });

    expect(list).toHaveBeenCalledTimes(1);
    expect(list.mock.calls[0][0]).toMatchObject({
      singleEvents: true,
      orderBy: 'startTime',
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'evt-1',
      title: 'Standup',
      location: 'Room A',
      allDay: false,
    });
  });
});
