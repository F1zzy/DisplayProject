const f1Standings = require('../services/f1Standings');
const f1Live = require('../services/f1Live');
const f1Logos = require('../services/f1Logos');
const f1Media = require('../services/f1Media');

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

const NEXT_RACE_FIXTURE = {
  MRData: {
    RaceTable: {
      season: '2026',
      round: '12',
      Races: [
        {
          season: '2026',
          round: '12',
          raceName: 'Dutch Grand Prix',
          Circuit: {
            circuitId: 'zandvoort',
            circuitName: 'Circuit Park Zandvoort',
            Location: { locality: 'Zandvoort', country: 'Netherlands' },
          },
          date: '2026-08-23',
          time: '13:00:00Z',
          Qualifying: { date: '2026-08-22', time: '14:00:00Z' },
          Sprint: { date: '2026-08-22', time: '10:00:00Z' },
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

describe('f1Standings.mapNextRace', () => {
  test('flattens the race, circuit and session times', () => {
    expect(f1Standings.mapNextRace(NEXT_RACE_FIXTURE)).toEqual({
      round: 12,
      raceName: 'Dutch Grand Prix',
      circuitId: 'zandvoort',
      circuitName: 'Circuit Park Zandvoort',
      locality: 'Zandvoort',
      country: 'Netherlands',
      startsAt: '2026-08-23T13:00:00.000Z',
      qualifying: '2026-08-22T14:00:00.000Z',
      sprint: '2026-08-22T10:00:00.000Z',
    });
  });

  test('falls back to midnight when a race has no time', () => {
    const noTime = {
      MRData: { RaceTable: { Races: [{ round: '1', raceName: 'Test GP', date: '2026-03-08' }] } },
    };

    const race = f1Standings.mapNextRace(noTime);
    expect(race.startsAt).toBe('2026-03-08T00:00:00.000Z');
    expect(race.qualifying).toBeNull();
    expect(race.sprint).toBeNull();
  });

  test('returns null when the season has no next race', () => {
    expect(f1Standings.mapNextRace({ MRData: { RaceTable: { Races: [] } } })).toBeNull();
    expect(f1Standings.mapNextRace({})).toBeNull();
  });
});

describe('f1Standings.applyPositionChanges', () => {
  const rows = [
    { driverId: 'antonelli', position: 1 },
    { driverId: 'hamilton', position: 2 },
    { driverId: 'norris', position: 3 },
    { driverId: 'rookie', position: 4 },
  ];

  const previous = [
    { driverId: 'hamilton', position: 1 },
    { driverId: 'antonelli', position: 3 },
    { driverId: 'norris', position: 3 },
  ];

  test('reports places gained as positive and lost as negative', () => {
    const result = f1Standings.applyPositionChanges(rows, previous, 'driverId');

    expect(result[0].positionChange).toBe(2);
    expect(result[1].positionChange).toBe(-1);
  });

  test('reports an unchanged position as zero', () => {
    const result = f1Standings.applyPositionChanges(rows, previous, 'driverId');
    expect(result[2].positionChange).toBe(0);
  });

  test('leaves an entry with no history as null', () => {
    const result = f1Standings.applyPositionChanges(rows, previous, 'driverId');
    expect(result[3].positionChange).toBeNull();
  });

  test('marks every row null when there is no previous round', () => {
    const result = f1Standings.applyPositionChanges(rows, [], 'driverId');
    expect(result.map((row) => row.positionChange)).toEqual([null, null, null, null]);
  });

  test('preserves the original row fields and tolerates bad input', () => {
    const [first] = f1Standings.applyPositionChanges(
      [{ constructorId: 'mercedes', position: 1, points: 379 }],
      [{ constructorId: 'mercedes', position: 2 }],
      'constructorId'
    );

    expect(first).toMatchObject({ constructorId: 'mercedes', points: 379, positionChange: 1 });
    expect(f1Standings.applyPositionChanges(null, previous, 'driverId')).toEqual([]);
  });
});

describe('f1Media circuit and flag maps', () => {
  test('maps Jolpica circuit ids onto F1 CDN slugs', () => {
    expect(f1Media.slugForCircuit('zandvoort')).toBe('Netherlands');
    expect(f1Media.slugForCircuit('silverstone')).toBe('Great_Britain');
    expect(f1Media.slugForCircuit('miami')).toBe('Miami');
    expect(f1Media.slugForCircuit('vegas')).toBe('Las_Vegas');
    expect(f1Media.slugForCircuit('yas_marina')).toBe('Abu_Dhabi');
    expect(f1Media.slugForCircuit('baku')).toBe('Baku');
  });

  test('maps Jolpica country names onto ISO codes', () => {
    expect(f1Media.isoForCountry('Netherlands')).toBe('nl');
    expect(f1Media.isoForCountry('UK')).toBe('gb');
    expect(f1Media.isoForCountry('USA')).toBe('us');
    expect(f1Media.isoForCountry('UAE')).toBe('ae');
    expect(f1Media.isoForCountry('Saudi Arabia')).toBe('sa');
  });

  test('returns null for unknown circuit or country', () => {
    expect(f1Media.slugForCircuit('not_a_circuit')).toBeNull();
    expect(f1Media.slugForCircuit('')).toBeNull();
    expect(f1Media.isoForCountry('Narnia')).toBeNull();
    expect(f1Media.isoForCountry('')).toBeNull();
  });
});

describe('f1Logos.resolveConstructorId', () => {
  test('maps live timing team names onto constructor ids', () => {
    expect(f1Logos.resolveConstructorId('Red Bull Racing')).toBe('red_bull');
    expect(f1Logos.resolveConstructorId('Racing Bulls')).toBe('rb');
    expect(f1Logos.resolveConstructorId('Haas F1 Team')).toBe('haas');
    expect(f1Logos.resolveConstructorId('Aston Martin')).toBe('aston_martin');
  });

  test('falls back to the normalised name, which is usually the CDN slug', () => {
    expect(f1Logos.slugFor(f1Logos.resolveConstructorId('Williams'))).toBe('williams');
    expect(f1Logos.slugFor(f1Logos.resolveConstructorId('Some New Team'))).toBe('somenewteam');
  });

  test('returns null for a missing name', () => {
    expect(f1Logos.resolveConstructorId('')).toBeNull();
    expect(f1Logos.resolveConstructorId(null)).toBeNull();
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
      1: {
        RacingNumber: '1',
        Tla: 'VER',
        TeamColour: '3671C6',
        FullName: 'Max Verstappen',
        TeamName: 'Red Bull Racing',
      },
      44: {
        RacingNumber: '44',
        Tla: 'HAM',
        TeamColour: 'E8002D',
        FullName: 'Lewis Hamilton',
        TeamName: 'Ferrari',
      },
      12: { RacingNumber: '12', Tla: 'ANT', TeamColour: '27F4D2', FullName: 'Kimi Antonelli' },
    },
    TimingData: {
      Lines: {
        1: { Position: '2', GapToLeader: '+3.410', IntervalToPositionAhead: { Value: '+3.410' } },
        44: { Position: '1', GapToLeader: '' },
        12: { Position: '3', GapToLeader: '+9.8', InPit: true },
      },
    },
    TimingAppData: {
      Lines: {
        1: { GridPos: '1' },
        44: { GridPos: '4' },
        12: { GridPos: '0' },
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

  test('derives places gained or lost from the starting grid', () => {
    const byCode = Object.fromEntries(
      f1Live.buildSnapshot(feed, { connected: true }).order.map((entry) => [entry.code, entry])
    );

    // HAM started 4th and leads; VER started on pole and sits 2nd.
    expect(byCode.HAM).toMatchObject({ gridPosition: 4, positionChange: 3 });
    expect(byCode.VER).toMatchObject({ gridPosition: 1, positionChange: -1 });
  });

  test('resolves a constructor id from the team name for logos', () => {
    const byCode = Object.fromEntries(
      f1Live.buildSnapshot(feed, { connected: true }).order.map((entry) => [entry.code, entry])
    );

    expect(byCode.VER.constructorId).toBe('red_bull');
    expect(byCode.HAM.constructorId).toBe('ferrari');
    // No TeamName in the feed yet, so there is nothing to show.
    expect(byCode.ANT.constructorId).toBeNull();
  });

  test('treats a pit-lane start (GridPos 0) as having no delta', () => {
    const byCode = Object.fromEntries(
      f1Live.buildSnapshot(feed, { connected: true }).order.map((entry) => [entry.code, entry])
    );

    expect(byCode.ANT.gridPosition).toBeNull();
    expect(byCode.ANT.positionChange).toBeNull();
  });

  test('omits deltas when TimingAppData has not arrived', () => {
    const withoutApp = { ...feed, TimingAppData: undefined };
    const snapshot = f1Live.buildSnapshot(withoutApp, { connected: true });

    expect(snapshot.order).toHaveLength(3);
    expect(snapshot.order.every((entry) => entry.positionChange === null)).toBe(true);
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
