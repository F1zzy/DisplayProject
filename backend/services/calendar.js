require('dotenv').config();

const { google } = require('googleapis');
const cache = require('./cache');

const CALENDAR_TTL_MS = 5 * 60 * 1000;
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

function isConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN
  );
}

function getCalendarId() {
  return process.env.GOOGLE_CALENDAR_ID || 'primary';
}

function createOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

function formatTime(dateTime, dateOnly) {
  if (dateOnly) return 'All day';
  const date = new Date(dateTime);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function normalizeEvent(event) {
  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  const startRaw = event.start?.dateTime || event.start?.date;
  const endRaw = event.end?.dateTime || event.end?.date;
  const startMs = startRaw ? new Date(startRaw).getTime() : null;

  return {
    id: event.id,
    time: formatTime(startRaw, allDay),
    endTime: allDay || !endRaw ? null : formatTime(endRaw, false),
    title: event.summary || '(No title)',
    location: event.location || '',
    allDay,
    startMs,
    start: startRaw || null,
    end: endRaw || null,
  };
}

function endOfDayOffset(days) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (days > 1) {
    end.setDate(end.getDate() + (days - 1));
  }
  return end;
}

/**
 * @param {{ days?: number, calendarClient?: object }} [options]
 */
async function getUpcomingEvents({ days = 1, calendarClient } = {}) {
  if (!isConfigured() && !calendarClient) {
    const error = new Error('Google Calendar is not configured');
    error.code = 'CALENDAR_NOT_CONFIGURED';
    throw error;
  }

  const dayCount = Math.min(Math.max(parseInt(days, 10) || 1, 1), 7);
  const calendarId = getCalendarId();
  const cacheKey = `calendar:events:${calendarId}:${dayCount}`;
  if (!calendarClient) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }

  const auth = calendarClient ? null : createOAuthClient();
  const calendar =
    calendarClient ||
    google.calendar({ version: 'v3', auth });

  const timeMin = new Date();
  timeMin.setHours(0, 0, 0, 0);

  const response = await calendar.events.list({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: endOfDayOffset(dayCount).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  });

  const events = (response.data.items || []).map(normalizeEvent);
  if (!calendarClient) {
    cache.set(cacheKey, events, CALENDAR_TTL_MS);
  }
  return events;
}

module.exports = {
  SCOPES,
  isConfigured,
  getCalendarId,
  getUpcomingEvents,
  normalizeEvent,
};
