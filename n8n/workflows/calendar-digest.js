// calendar-digest
// Two scheduled Discord posts:
//   Sunday 9 AM → 3-week calendar digest to #announcements
//   Daily 6 PM  → night-before reminder if meeting tomorrow (skips DARK)
//
// Credentials to configure in n8n:
//   - "Google Calendar" → googleCalendarOAuth2Api
//   - "Discord Bot"     → discordBotApi (bot token)
//
// Replace placeholder IDs:
//   000000000000000000 → your Discord Guild ID
//   000000000000000002 → #announcements channel ID

import { workflow, node, trigger, newCredential, expr } from '@n8n/workflow-sdk';

const sundaySchedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Sunday 9AM Schedule',
    parameters: {
      rule: {
        interval: [{
          field: 'weeks',
          weeksInterval: 1,
          triggerAtDay: [0],
          triggerAtHour: 9,
          triggerAtMinute: 0
        }]
      }
    },
    position: [240, 300]
  },
  output: [{}]
});

const get3WeekEvents = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Get 3 Weeks Events',
    parameters: {
      resource: 'event',
      operation: 'getAll',
      calendar: { __rl: true, mode: 'id', value: 'primary' },
      returnAll: false,
      limit: 50,
      timeMin: expr('{{ $today.toISO() }}'),
      timeMax: expr('{{ $today.plus({ days: 21 }).toISO() }}'),
      options: {
        singleEvents: true,
        orderBy: 'startTime'
      }
    },
    credentials: { googleCalendarOAuth2Api: newCredential('Google Calendar') },
    position: [480, 300]
  },
  output: [{ summary: 'Stated Meeting', start: { dateTime: '2024-01-01T19:00:00Z' }, description: '' }]
});

const formatWeeklyDigest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format Weekly Digest',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const items = $input.all();
let msg = '**\u{1f4cb} Lodge Calendar — Next 3 Weeks**\\n\\n';
if (!items || items.length === 0) {
  msg += 'No events scheduled.';
} else {
  items.forEach(item => {
    const ev = item.json;
    const dt = ev.start?.dateTime || ev.start?.date || '';
    const d = dt ? new Date(dt) : null;
    const dateStr = d
      ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'TBD';
    const timeStr = ev.start?.dateTime && d
      ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '';
    msg += '• **' + (ev.summary || 'Event') + '**';
    if (timeStr) msg += ' at ' + timeStr;
    msg += ' — ' + dateStr + '\\n';
  });
}
return [{ json: { message: msg } }];`
    },
    position: [720, 300]
  },
  output: [{ message: '**Lodge Calendar — Next 3 Weeks**\n\n• **Stated Meeting** at 7:00 PM — Mon, Jan 1' }]
});

const postWeeklyDigest = node({
  type: 'n8n-nodes-base.discord',
  version: 2,
  config: {
    name: 'Post Weekly Digest',
    parameters: {
      resource: 'message',
      operation: 'send',
      authentication: 'botToken',
      guildId: { __rl: true, mode: 'id', value: '000000000000000000' },
      sendTo: 'channel',
      channelId: { __rl: true, mode: 'id', value: '000000000000000002' },
      content: expr('{{ $json.message }}')
    },
    credentials: { discordBotApi: newCredential('Discord Bot') },
    position: [960, 300]
  },
  output: [{ id: 'msg1' }]
});

const dailySchedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Daily 6PM Schedule',
    parameters: {
      rule: {
        interval: [{
          field: 'days',
          daysInterval: 1,
          triggerAtHour: 18,
          triggerAtMinute: 0
        }]
      }
    },
    position: [240, 600]
  },
  output: [{}]
});

const getTomorrowEvent = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: "Get Tomorrow's Event",
    parameters: {
      resource: 'event',
      operation: 'getAll',
      calendar: { __rl: true, mode: 'id', value: 'primary' },
      returnAll: false,
      limit: 5,
      timeMin: expr('{{ $today.plus({ days: 1 }).toISO() }}'),
      timeMax: expr('{{ $today.plus({ days: 2 }).toISO() }}'),
      options: {
        singleEvents: true,
        orderBy: 'startTime'
      }
    },
    credentials: { googleCalendarOAuth2Api: newCredential('Google Calendar') },
    position: [480, 600]
  },
  output: [{ summary: 'Stated Meeting', start: { dateTime: '2024-01-02T19:00:00Z' }, description: '' }]
});

const checkTomorrowEvent = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Check Tomorrow Event',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const items = $input.all();
if (!items || items.length === 0) return [];
const ev = items[0].json;
const title = (ev.summary || '').toUpperCase();
if (title.includes('DARK')) return [];   // skip dark nights
let type = 'SPECIAL';
if (title.includes('STATED'))           type = 'STATED';
else if (title.includes('DEGREE'))      type = 'DEGREE';
else if (title.includes('INSTRUCTION')) type = 'INSTRUCTION';
const dt = ev.start?.dateTime || ev.start?.date || '';
const d = dt ? new Date(dt) : null;
const timeStr = ev.start?.dateTime && d
  ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  : '';
const dressMatch = (ev.description || '').match(/DRESS:\\s*([^\\n]+)/i);
const dress = dressMatch ? ' · ' + dressMatch[1].trim() : '';
const msg = '\u{1f514} **Lodge tomorrow!**\\n' +
  '**' + (ev.summary || 'Event') + '**' +
  (timeStr ? ' at ' + timeStr : '') + dress + '\\n' +
  'Type: ' + type;
return [{ json: { message: msg } }];`
    },
    position: [720, 600]
  },
  output: [{ message: '🔔 **Lodge tomorrow!**\n**Stated Meeting** at 7:30 PM · Business Attire\nType: STATED' }]
});

const postDailyReminder = node({
  type: 'n8n-nodes-base.discord',
  version: 2,
  config: {
    name: 'Post Daily Reminder',
    parameters: {
      resource: 'message',
      operation: 'send',
      authentication: 'botToken',
      guildId: { __rl: true, mode: 'id', value: '000000000000000000' },
      sendTo: 'channel',
      channelId: { __rl: true, mode: 'id', value: '000000000000000002' },
      content: expr('{{ $json.message }}')
    },
    credentials: { discordBotApi: newCredential('Discord Bot') },
    position: [960, 600]
  },
  output: [{ id: 'msg2' }]
});

export default workflow('calendar-digest', 'Calendar Digest')
  .add(sundaySchedule)
  .to(get3WeekEvents)
  .to(formatWeeklyDigest)
  .to(postWeeklyDigest)
  .add(dailySchedule)
  .to(getTomorrowEvent)
  .to(checkTomorrowEvent)
  .to(postDailyReminder);
