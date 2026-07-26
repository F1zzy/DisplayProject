const f1Standings = require('../services/f1Standings');
const f1Live = require('../services/f1Live');

const DRIVER_STANDINGS_FIXTURE = {
  MRData: {
    StandingsTable: {
      season: '2026',
      round: '11',
      StandingsLists: [
        {
          season: '2026',
          round: '11',
          DriverStandings: [
            {
              position: '1',
              points: '219',
              wins: '6',
              Driver: {
                driverId: 'antonelli',
                permanentNumber: '12',
                code: 'ANT',
                givenName: 'Andrea Kimi',
                familyName: 'Antonelli',
              },
              Constructors: [{ constructorId: 'mercedes', name: 'Mercedes' }],
            },
            {
              position: '2',
              points: '169',
              wins: '1',
              Driver: {
                driverId: 'hamilton',
                permanentNumber: '44',
                code: 'HAM',
                givenName: 'Lewis',
                familyName: 'Hamilton',
              },
              Constructors: [{ constructorId: 'ferrari', name: 'Ferrari' }],
            },
          ],
        },
      ],
    },
  },
};

const CONSTRUCTOR_STANDINGS_FIXTURE = {
  MRData: {
    StandingsTable: {
      season: '2026',
      StandingsLists: [
        {
          season: '2026',
          round: '11',
          ConstructorStandings: [
            {
              position: '1',
              points: '379',
              wins: '7',
              Constructor: { constructorId: 'mercedes', name: 'Mercedes', nationality: 'German' },
            },
          ],
        },
      ],
    },
  },
};

describe('f1Standings mappers', () => {
  test('mapDriverStandings flattens driver + constructor into rows', () => {
    const drivers = f1Standings.mapDriverStandings(DRIVER_STANDINGS_FIXTURE);

    expect(drivers).toHaveLength(2);
    expect(drivers[0]).toMatchObject({
      position: 1,
      code: 'ANT',
      familyName: 'Antonelli',
      number: 12,
      constructor: 'Mercedes',
      points: 219,
      wins: 6,
    });
    expect(drivers[1].code).toBe('HAM');
  });

  test('mapConstructorStandings flattens team rows', () => {
    const teams = f1Standings.mapConstructorStandings(CONSTRUCTOR_STANDINGS_FIXTURE);

    expect(teams).toHaveLength(1);
    expect(teams[0]).toMatchObject({ position: 1, name: 'Mercedes', points: 379, wins: 7 });
  });

  test('mappers tolerate an empty or malformed payload', () => {
    expect(f1Standings.mapDriverStandings({})).toEqual([]);
    expect(f1Standings.mapConstructorStandings(null)).toEqual([]);
  });

  test('readSeasonMeta reads season and round', () => {
    expect(f1Standings.readSeasonMeta(DRIVER_STANDINGS_FIXTURE)).toEqual({
      season: '2026',
      round: 11,
    });
  });
});

describe('f1Live.parseStreamingStatus', () => {
  test('treats the BOM-prefixed Offline payload as not live', () => {
    expect(f1Live.parseStreamingStatus('\uFEFF{"Status":"Offline"}')).toBe(false);
  });

  test('treats any other status as live', () => {
    expect(f1Live.parseStreamingStatus('\uFEFF{"Status":"Available"}')).toBe(true);
  });

  test('returns false for malformed input', () => {
    expect(f1Live.parseStreamingStatus('not json')).toBe(false);
    expect(f1Live.parseStreamingStatus('')).toBe(false);
    expect(f1Live.parseStreamingStatus(null)).toBe(false);
  });
});

describe('f1Live.parseFrames', () => {
  const RS = '\u001e';

  test('splits complete frames and keeps the trailing partial', () => {
    const { messages, remainder } = f1Live.parseFrames(
      `{"type":6}${RS}{"type":1,"target":"feed"}${RS}{"type":1,"tar`
    );

    expect(messages).toEqual([{ type: 6 }, { type: 1, target: 'feed' }]);
    expect(remainder).toBe('{"type":1,"tar');
  });

  test('skips malformed frames without throwing', () => {
    const { messages } = f1Live.parseFrames(`nonsense${RS}{"type":6}${RS}`);
    expect(messages).toEqual([{ type: 6 }]);
  });
});

describe('f1Live.mergeState', () => {
  test('deep merges a delta into existing state', () => {
    const base = {
      Lines: {
        1: { Position: '1', GapToLeader: '', IntervalToPositionAhead: { Value: '' } },
        44: { Position: '2', GapToLeader: '+1.203' },
      },
    };

    const merged = f1Live.mergeState(base, {
      Lines: { 44: { Position: '2', IntervalToPositionAhead: { Value: '+1.203' } } },
    });

    expect(merged.Lines['1'].Position).toBe('1');
    expect(merged.Lines['44']).toEqual({
      Position: '2',
      GapToLeader: '+1.203',
      IntervalToPositionAhead: { Value: '+1.203' },
    });
  });

  test('replaces scalars and arrays rather than merging them', () => {
    expect(f1Live.mergeState({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
    expect(f1Live.mergeState({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] });
  });

  test('does not mutate the previous state', () => {
    const base = { Lines: { 1: { Position: '1' } } };
    f1Live.mergeState(base, { Lines: { 1: { Position: '3' } } });
    expect(base.Lines['1'].Position).toBe('1');
  });
});

describe('f1Live.buildSnapshot', () => {
  const feed = {
    SessionInfo: { Name: 'Race', Meeting: { Name: 'British Grand Prix' } },
    SessionStatus: { Status: 'Started' },
    TrackStatus: { Status: '4', Message: 'SCDeployed' },
    LapCount: { CurrentLap: 23, TotalLaps: 52 },
    DriverList: {
      1: { RacingNumber: '1', Tla: 'VER', TeamColour: '3671C6', FullName: 'Max Verstappen' },
      44: { RacingNumber: '44', Tla: 'HAM', TeamColour: 'E8002D', FullName: 'Lewis Hamilton' },
      12: { RacingNumber: '12', Tla: 'ANT', TeamColour: '27F4D2', FullName: 'Kimi Antonelli' },
    },
    TimingData: {
      Lines: {
        1: { Position: '2', GapToLeader: '+3.410', IntervalToPositionAhead: { Value: '+3.410' } },
        44: { Position: '1', GapToLeader: '' },
        12: { Position: '3', GapToLeader: '+9.8', InPit: true },
      },
    },
  };

  test('projects the feed into an ordered live classification', () => {
    const snapshot = f1Live.buildSnapshot(feed, { connected: true });

    expect(snapshot.active).toBe(true);
    expect(snapshot.sessionName).toBe('Race');
    expect(snapshot.meetingName).toBe('British Grand Prix');
    expect(snapshot.trackStatus).toBe('Safety Car');
    expect(snapshot.lap).toBe(23);
    expect(snapshot.totalLaps).toBe(52);
    expect(snapshot.order.map((entry) => entry.code)).toEqual(['HAM', 'VER', 'ANT']);
    expect(snapshot.order[1].teamColour).toBe('#3671C6');
    expect(snapshot.order[2].inPit).toBe(true);
  });

  test('is inactive when disconnected', () => {
    expect(f1Live.buildSnapshot(feed, { connected: false }).active).toBe(false);
  });

  test('is inactive once the session is finalised', () => {
    const finished = { ...feed, SessionStatus: { Status: 'Finalised' } };
    expect(f1Live.buildSnapshot(finished, { connected: true }).active).toBe(false);
  });

  test('handles an empty feed', () => {
    const snapshot = f1Live.buildSnapshot({}, { connected: true });
    expect(snapshot.active).toBe(false);
    expect(snapshot.order).toEqual([]);
  });
});

describe('f1Live.getLiveSnapshot', () => {
  test('returns an inactive snapshot when nothing is streaming', () => {
    const snapshot = f1Live.getLiveSnapshot();
    expect(snapshot.active).toBe(false);
    expect(snapshot.order).toEqual([]);
  });
});
