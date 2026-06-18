// tonight-and-events
// Serves two webhooks:
//   GET /webhook/tyled/tonight → tonight's event shaped for the display
//   GET /webhook/tyled/events  → next 60 days of events
//
// Credentials to configure in n8n:
//   - "Google Calendar" → googleCalendarOAuth2Api
//     Set calendar ID to your lodge's Google Calendar ID
//   - "Tyled Postgres"  → postgres (Neon connection)

import { workflow, node, trigger, newCredential, expr } from '@n8n/workflow-sdk';

// ─── Tonight flow ────────────────────────────────────────────────────────────

const tonightWebhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'GET Tonight Webhook',
    parameters: {
      httpMethod: 'GET',
      path: 'tyled/tonight',
      responseMode: 'responseNode'
    },
    position: [240, 300]
  },
  output: [{}]
});

const checkTonightOverride = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.5,
  config: {
    name: 'Check Tonight Override',
    parameters: {
      resource: 'database',
      operation: 'select',
      schema: { __rl: true, mode: 'name', value: 'public' },
      table:  { __rl: true, mode: 'name', value: 'tyled_config' },
      limit: 1,
      where: {
        values: [{ column: 'key', value: 'tonight_override' }]
      }
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 300]
  },
  output: [{ key: 'tonight_override', value: { active: false } }]
});

const branchOnOverride = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: {
    name: 'Override Active?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        combinator: 'and',
        conditions: [
          {
            id: 'override-check',
            operator: { type: 'boolean', operation: 'true' },
            leftValue: expr('{{ $json.value.active }}'),
            rightValue: ''
          }
        ]
      }
    },
    position: [720, 300]
  },
  output: [{}, {}]
});

// Branch: override is active — shape from stored value
const shapeOverride = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Shape Override',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const ov = $input.first().json.value;
return [{
  json: {
    hasEvent: true,
    title:   ov.title   || '',
    type:    ov.type    || 'STATED',
    time:    ov.time    || '',
    dress:   ov.dress   || '',
    agenda:  Array.isArray(ov.agenda) ? ov.agenda : [],
    notes:   ov.notes   || '',
    weather: null
  }
}];`
    },
    position: [960, 200]
  },
  output: [{ hasEvent: true, title: 'Stated Communication', type: 'STATED', time: '7:30 PM', dress: 'Business Attire', agenda: ['Opening'], notes: '', weather: null }]
});

const respondTonightOverride = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Tonight Override',
    parameters: { respondWith: 'firstIncomingItem' },
    position: [1200, 200]
  },
  output: [{}]
});

// Branch: no override — query Google Calendar
const getTodayEvents = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Get Today Events',
    parameters: {
      resource: 'event',
      operation: 'getAll',
      calendar: { __rl: true, mode: 'id', value: 'primary' },
      returnAll: false,
      limit: 10,
      timeMin: expr('{{ $today.toISO() }}'),
      timeMax: expr('{{ $today.plus({ days: 1 }).toISO() }}'),
      options: {
        singleEvents: true,
        orderBy: 'startTime'
      }
    },
    credentials: { googleCalendarOAuth2Api: newCredential('Google Calendar') },
    position: [960, 400]
  },
  output: [{ summary: 'Stated Meeting', start: { dateTime: '2024-01-01T19:00:00Z' }, description: 'AGENDA: Opening\nDRESS: Dark Suit' }]
});

const shapeTonightEvent = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Shape Tonight Event',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const items = $input.all();
if (!items || items.length === 0) {
  return [{ json: { hasEvent: false, title: 'Lodge Dark', type: 'DARK', time: '', agenda: [], dress: '', notes: '', weather: null } }];
}
const ev = items[0].json;
const title = (ev.summary || '').toUpperCase();
let type = 'SPECIAL';
if (title.includes('STATED'))      type = 'STATED';
else if (title.includes('DEGREE')) type = 'DEGREE';
else if (title.includes('INSTRUCTION')) type = 'INSTRUCTION';
else if (title.includes('DARK'))   type = 'DARK';

const desc = ev.description || '';

const dressMatch = desc.match(/DRESS:\\s*([^\\n]+)/i);
const dress = dressMatch ? dressMatch[1].trim() : '';

const agendaMatch = desc.match(/AGENDA:\\s*([\\s\\S]*?)(?:\\n[A-Z]+:|$)/i);
const agenda = agendaMatch
  ? agendaMatch[1].split('\\n').map(s => s.trim()).filter(Boolean)
  : [];

let timeStr = '';
if (ev.start?.dateTime) {
  const d = new Date(ev.start.dateTime);
  timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

return [{
  json: {
    hasEvent: true,
    title: ev.summary || '',
    type,
    time: timeStr,
    dress,
    agenda,
    notes: desc.replace(/DRESS:[^\\n]*/i, '').replace(/AGENDA:[\\s\\S]*/i, '').trim(),
    weather: null
  }
}];`
    },
    position: [1200, 400]
  },
  output: [{ hasEvent: true, title: 'Stated Meeting', type: 'STATED', time: '7:00 PM', dress: 'Dark Suit', agenda: ['Opening', 'Reading of Minutes'], notes: '', weather: null }]
});

const respondTonight = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Tonight JSON',
    parameters: { respondWith: 'firstIncomingItem' },
    position: [1440, 400]
  },
  output: [{}]
});

// ─── Events flow ─────────────────────────────────────────────────────────────

const eventsWebhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'GET Events Webhook',
    parameters: {
      httpMethod: 'GET',
      path: 'tyled/events',
      responseMode: 'responseNode'
    },
    position: [240, 700]
  },
  output: [{}]
});

const getNext60DayEvents = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Get Next 60 Days Events',
    parameters: {
      resource: 'event',
      operation: 'getAll',
      calendar: { __rl: true, mode: 'id', value: 'primary' },
      returnAll: false,
      limit: 50,
      timeMin: expr('{{ $today.toISO() }}'),
      timeMax: expr('{{ $today.plus({ days: 60 }).toISO() }}'),
      options: {
        singleEvents: true,
        orderBy: 'startTime'
      }
    },
    credentials: { googleCalendarOAuth2Api: newCredential('Google Calendar') },
    position: [480, 700]
  },
  output: [{ summary: 'Stated Meeting', start: { dateTime: '2024-01-01T19:00:00Z' } }]
});

const shapeEventsList = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Shape Events List',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const items = $input.all();
return items.map(item => {
  const ev = item.json;
  const dt = ev.start?.dateTime || ev.start?.date || '';
  const d = dt ? new Date(dt) : null;
  const title = (ev.summary || '').toUpperCase();
  let type = 'SPECIAL';
  if (title.includes('STATED'))           type = 'STATED';
  else if (title.includes('DEGREE'))      type = 'DEGREE';
  else if (title.includes('INSTRUCTION')) type = 'INSTRUCTION';
  else if (title.includes('DARK'))        type = 'DARK';
  return {
    json: {
      day:   d ? d.getDate() : null,
      month: d ? d.toLocaleString('en-US', { month: 'short' }) : null,
      title: ev.summary || '',
      time:  d && ev.start?.dateTime ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'All Day',
      type,
      date:  dt,
      start: dt
    }
  };
});`
    },
    position: [720, 700]
  },
  output: [{ day: 1, month: 'Jan', title: 'Stated Meeting', time: '7:00 PM', type: 'STATED', date: '2024-01-01T19:00:00Z' }]
});

const respondEvents = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Events Array',
    parameters: { respondWith: 'allIncomingItems' },
    position: [960, 700]
  },
  output: [{}]
});

export default workflow('tonight-and-events', 'Tonight and Events')
  // Tonight flow: check override → branch → respond
  .add(tonightWebhookTrigger)
  .to(checkTonightOverride)
  .to(branchOnOverride)
  // true branch (output 0) → override active
  .branch(0, shapeOverride)
  .to(respondTonightOverride)
  // false branch (output 1) → Calendar
  .branch(1, getTodayEvents)
  .to(shapeTonightEvent)
  .to(respondTonight)
  // Events flow (independent)
  .add(eventsWebhookTrigger)
  .to(getNext60DayEvents)
  .to(shapeEventsList)
  .to(respondEvents);
