// admin-api
// All admin panel endpoints + public config endpoint + Pi polling endpoint.
//
// n8n environment variables required:
//   TYLED_ADMIN_PASSWORD — the admin panel password
//
// Auth: POST requests include { token } in body.
// n8n checks token === TYLED_ADMIN_PASSWORD.
//
// Endpoints:
//   POST /webhook/tyled/admin/auth           → validate token
//   POST /webhook/tyled/admin/config         → get all config (tv + tonight + slides)
//   POST /webhook/tyled/admin/tv/command     → queue TV on/off command for Pi
//   POST /webhook/tyled/admin/tv/schedule    → save TV schedule
//   POST /webhook/tyled/admin/tonight        → save/clear tonight override
//   POST /webhook/tyled/admin/slides         → save slide config
//   POST /webhook/tyled/admin/members        → list all members
//   POST /webhook/tyled/admin/members/add    → add member
//   POST /webhook/tyled/admin/members/delete → delete member
//   GET  /webhook/tyled/config               → public slide config (used by display)
//   GET  /webhook/tyled/pi/poll              → Pi polls for pending TV commands
//   POST /webhook/tyled/pi/ack              → Pi acknowledges command execution

import { workflow, node, trigger, newCredential, expr } from '@n8n/workflow-sdk';

// ── Shared auth check code ────────────────────────────────────────────────────
// Paste this into Code nodes on each admin branch to validate the token.
const AUTH_JS = `
const token    = $json.body?.token;
const expected = $env.TYLED_ADMIN_PASSWORD;
if (!token || token !== expected) {
  return [{ json: { __unauthorized: true } }];
}
return [{ json: { ...$json.body, __authorized: true } }];
`;

const UNAUTHORIZED_JS = `
// If auth check returned __unauthorized, respond 401 and stop.
if ($json.__unauthorized) {
  // n8n doesn't support HTTP status codes on respondToWebhook directly,
  // so we return a clear error body. The admin panel checks for ok: false.
  return [{ json: { ok: false, error: 'Unauthorized' } }];
}
return $input.all();
`;

// ── POST /admin/auth ──────────────────────────────────────────────────────────
const authTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'POST Auth',
    parameters: { httpMethod: 'POST', path: 'tyled/admin/auth', responseMode: 'responseNode' },
    position: [240, 100]
  },
  output: [{ body: { token: 'secret' } }]
});

const authCheck = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validate Token',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const token = $input.first().json.body?.token;
const expected = $env.TYLED_ADMIN_PASSWORD;
const ok = !!(token && token === expected);
return [{ json: { ok } }];`
    },
    position: [480, 100]
  },
  output: [{ ok: true }]
});

const respondAuth = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Auth',
    parameters: { respondWith: 'firstIncomingItem' },
    position: [720, 100]
  },
  output: [{}]
});

// ── POST /admin/config ────────────────────────────────────────────────────────
const configTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'POST Config',
    parameters: { httpMethod: 'POST', path: 'tyled/admin/config', responseMode: 'responseNode' },
    position: [240, 300]
  },
  output: [{ body: { token: 'secret' } }]
});

const configAuth = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Auth Config',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: AUTH_JS
    },
    position: [480, 300]
  },
  output: [{ __authorized: true }]
});

const fetchConfig = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch All Config',
    parameters: {
      operation: 'executeQuery',
      query: `SELECT key, value FROM tyled_config WHERE key IN ('tv_schedule','tv_pending_command','tonight_override','slide_config')`
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [720, 300]
  },
  output: [{ key: 'tv_schedule', value: {} }]
});

const assembleConfig = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Assemble Config',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `if ($input.first().json.__unauthorized) {
  return [{ json: { ok: false, error: 'Unauthorized' } }];
}
const rows = $input.all();
const map = {};
rows.forEach(r => { map[r.json.key] = r.json.value; });
return [{
  json: {
    tv:      { schedule: map['tv_schedule'] || {}, pendingCommand: map['tv_pending_command'] || null },
    tonight: map['tonight_override'] || { active: false },
    slides:  map['slide_config']     || { home: true, events: true, photos: true, attendees: true, minutes: true }
  }
}];`
    },
    position: [960, 300]
  },
  output: [{ tv: {}, tonight: {}, slides: {} }]
});

const respondConfig = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Config',
    parameters: { respondWith: 'firstIncomingItem' },
    position: [1200, 300]
  },
  output: [{}]
});

// ── POST /admin/tv/command ────────────────────────────────────────────────────
const tvCommandTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'POST TV Command',
    parameters: { httpMethod: 'POST', path: 'tyled/admin/tv/command', responseMode: 'responseNode' },
    position: [240, 500]
  },
  output: [{ body: { token: 'secret', action: 'on' } }]
});

const tvCommandAuth = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Auth TV Command',
    parameters: { mode: 'runOnceForAllItems', jsCode: AUTH_JS },
    position: [480, 500]
  },
  output: [{ __authorized: true, action: 'on' }]
});

const saveCommand = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save TV Command',
    parameters: {
      operation: 'executeQuery',
      query: `INSERT INTO tyled_config (key, value, updated_at) VALUES ('tv_pending_command', $1::jsonb, NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      options: {
        queryReplacement: expr('{{ JSON.stringify({ action: $json.action, issuedAt: new Date().toISOString() }) }}')
      }
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [720, 500]
  },
  output: [{}]
});

const respondTvCommand = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond TV Command',
    parameters: { respondWith: 'json', responseBody: { ok: true, message: 'Command queued' } },
    position: [960, 500]
  },
  output: [{}]
});

// ── POST /admin/tv/schedule ───────────────────────────────────────────────────
const tvScheduleTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'POST TV Schedule',
    parameters: { httpMethod: 'POST', path: 'tyled/admin/tv/schedule', responseMode: 'responseNode' },
    position: [240, 700]
  },
  output: [{ body: { token: 'secret', schedule: {} } }]
});

const tvScheduleAuth = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Auth TV Schedule',
    parameters: { mode: 'runOnceForAllItems', jsCode: AUTH_JS },
    position: [480, 700]
  },
  output: [{ __authorized: true, schedule: {} }]
});

const saveTvSchedule = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save TV Schedule',
    parameters: {
      operation: 'executeQuery',
      query: `INSERT INTO tyled_config (key, value, updated_at) VALUES ('tv_schedule', $1::jsonb, NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      options: { queryReplacement: expr('{{ JSON.stringify($json.schedule) }}') }
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [720, 700]
  },
  output: [{}]
});

const respondTvSchedule = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond TV Schedule',
    parameters: { respondWith: 'json', responseBody: { ok: true } },
    position: [960, 700]
  },
  output: [{}]
});

// ── POST /admin/tonight ───────────────────────────────────────────────────────
const tonightTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'POST Tonight Override',
    parameters: { httpMethod: 'POST', path: 'tyled/admin/tonight', responseMode: 'responseNode' },
    position: [240, 900]
  },
  output: [{ body: { token: 'secret', override: {} } }]
});

const tonightAuth = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Auth Tonight',
    parameters: { mode: 'runOnceForAllItems', jsCode: AUTH_JS },
    position: [480, 900]
  },
  output: [{ __authorized: true, override: {} }]
});

const saveTonightOverride = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save Tonight Override',
    parameters: {
      operation: 'executeQuery',
      query: `INSERT INTO tyled_config (key, value, updated_at) VALUES ('tonight_override', $1::jsonb, NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      options: { queryReplacement: expr('{{ JSON.stringify($json.override) }}') }
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [720, 900]
  },
  output: [{}]
});

const respondTonight = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Tonight',
    parameters: { respondWith: 'json', responseBody: { ok: true } },
    position: [960, 900]
  },
  output: [{}]
});

// ── POST /admin/slides ────────────────────────────────────────────────────────
const slidesTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'POST Slides Config',
    parameters: { httpMethod: 'POST', path: 'tyled/admin/slides', responseMode: 'responseNode' },
    position: [240, 1100]
  },
  output: [{ body: { token: 'secret', slides: {} } }]
});

const slidesAuth = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Auth Slides',
    parameters: { mode: 'runOnceForAllItems', jsCode: AUTH_JS },
    position: [480, 1100]
  },
  output: [{ __authorized: true, slides: {} }]
});

const saveSlidesConfig = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save Slides Config',
    parameters: {
      operation: 'executeQuery',
      query: `INSERT INTO tyled_config (key, value, updated_at) VALUES ('slide_config', $1::jsonb, NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      options: { queryReplacement: expr('{{ JSON.stringify($json.slides) }}') }
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [720, 1100]
  },
  output: [{}]
});

const respondSlides = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Slides',
    parameters: { respondWith: 'json', responseBody: { ok: true } },
    position: [960, 1100]
  },
  output: [{}]
});

// ── POST /admin/members (list) ────────────────────────────────────────────────
const membersListTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'POST Members List',
    parameters: { httpMethod: 'POST', path: 'tyled/admin/members', responseMode: 'responseNode' },
    position: [240, 1300]
  },
  output: [{ body: { token: 'secret' } }]
});

const membersListAuth = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Auth Members List',
    parameters: { mode: 'runOnceForAllItems', jsCode: AUTH_JS },
    position: [480, 1300]
  },
  output: [{ __authorized: true }]
});

const selectMembers = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Select All Members',
    parameters: {
      operation: 'executeQuery',
      query: 'SELECT id, name, role, email, active FROM lodge_members ORDER BY name ASC'
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [720, 1300]
  },
  output: [{ id: 1, name: 'John Doe', role: 'Master Mason' }]
});

const respondMembersList = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Members List',
    parameters: { respondWith: 'allIncomingItems' },
    position: [960, 1300]
  },
  output: [{}]
});

// ── POST /admin/members/add ───────────────────────────────────────────────────
const membersAddTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'POST Members Add',
    parameters: { httpMethod: 'POST', path: 'tyled/admin/members/add', responseMode: 'responseNode' },
    position: [240, 1500]
  },
  output: [{ body: { token: 'secret', name: 'John', role: 'Master Mason', email: '' } }]
});

const membersAddAuth = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Auth Members Add',
    parameters: { mode: 'runOnceForAllItems', jsCode: AUTH_JS },
    position: [480, 1500]
  },
  output: [{ __authorized: true, name: 'John', role: 'Master Mason', email: '' }]
});

const insertMember = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Insert Member',
    parameters: {
      operation: 'executeQuery',
      query: 'INSERT INTO lodge_members (name, role, email) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET role = EXCLUDED.role, email = EXCLUDED.email RETURNING id, name, role',
      options: { queryReplacement: expr('{{ $json.name + "," + ($json.role || "") + "," + ($json.email || "") }}') }
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [720, 1500]
  },
  output: [{ id: 1, name: 'John', role: 'Master Mason' }]
});

const respondMembersAdd = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Members Add',
    parameters: { respondWith: 'firstIncomingItem' },
    position: [960, 1500]
  },
  output: [{}]
});

// ── POST /admin/members/delete ────────────────────────────────────────────────
const membersDeleteTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'POST Members Delete',
    parameters: { httpMethod: 'POST', path: 'tyled/admin/members/delete', responseMode: 'responseNode' },
    position: [240, 1700]
  },
  output: [{ body: { token: 'secret', id: 1 } }]
});

const membersDeleteAuth = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Auth Members Delete',
    parameters: { mode: 'runOnceForAllItems', jsCode: AUTH_JS },
    position: [480, 1700]
  },
  output: [{ __authorized: true, id: 1 }]
});

const deleteMember = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Delete Member',
    parameters: {
      operation: 'executeQuery',
      query: 'DELETE FROM lodge_members WHERE id = $1 RETURNING id',
      options: { queryReplacement: expr('{{ $json.id }}') }
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [720, 1700]
  },
  output: [{ id: 1 }]
});

const respondMembersDelete = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Members Delete',
    parameters: { respondWith: 'json', responseBody: { ok: true } },
    position: [960, 1700]
  },
  output: [{}]
});

// ── GET /webhook/tyled/config (public — used by display app) ──────────────────
const publicConfigTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'GET Public Config',
    parameters: { httpMethod: 'GET', path: 'tyled/config', responseMode: 'responseNode' },
    position: [240, 1900]
  },
  output: [{}]
});

const fetchPublicConfig = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch Slide Config',
    parameters: {
      operation: 'executeQuery',
      query: `SELECT value FROM tyled_config WHERE key = 'slide_config'`
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 1900]
  },
  output: [{ value: { home: true, events: true, photos: true, attendees: true, minutes: true } }]
});

const respondPublicConfig = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Shape Public Config',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const row = $input.first().json;
return [{ json: { slides: row.value || { home: true, events: true, photos: true, attendees: true, minutes: true } } }];`
    },
    position: [720, 1900]
  },
  output: [{ slides: {} }]
});

const respondPublicConfigWebhook = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Public Config',
    parameters: { respondWith: 'firstIncomingItem' },
    position: [960, 1900]
  },
  output: [{}]
});

// ── GET /webhook/tyled/pi/poll (Pi polls this for commands) ───────────────────
const piPollTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'GET Pi Poll',
    parameters: { httpMethod: 'GET', path: 'tyled/pi/poll', responseMode: 'responseNode' },
    position: [240, 2100]
  },
  output: [{}]
});

const fetchPiCommands = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch Pi Commands',
    parameters: {
      operation: 'executeQuery',
      query: `SELECT key, value FROM tyled_config WHERE key IN ('tv_pending_command', 'tv_schedule')`
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 2100]
  },
  output: [{ key: 'tv_pending_command', value: null }]
});

const shapePiResponse = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Shape Pi Response',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const rows = $input.all();
const map = {};
rows.forEach(r => { map[r.json.key] = r.json.value; });
return [{ json: { command: map['tv_pending_command'] || null, schedule: map['tv_schedule'] || {} } }];`
    },
    position: [720, 2100]
  },
  output: [{ command: null, schedule: {} }]
});

const respondPiPoll = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Pi Poll',
    parameters: { respondWith: 'firstIncomingItem' },
    position: [960, 2100]
  },
  output: [{}]
});

// ── POST /webhook/tyled/pi/ack (Pi acks executed command) ─────────────────────
const piAckTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'POST Pi Ack',
    parameters: { httpMethod: 'POST', path: 'tyled/pi/ack', responseMode: 'responseNode' },
    position: [240, 2300]
  },
  output: [{ body: { action: 'on' } }]
});

const clearPiCommand = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Clear Pending Command',
    parameters: {
      operation: 'executeQuery',
      query: `UPDATE tyled_config SET value = 'null'::jsonb, updated_at = NOW() WHERE key = 'tv_pending_command'`
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 2300]
  },
  output: [{}]
});

const respondPiAck = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Pi Ack',
    parameters: { respondWith: 'json', responseBody: { ok: true } },
    position: [720, 2300]
  },
  output: [{}]
});

// ── Export ────────────────────────────────────────────────────────────────────
export default workflow('admin-api', 'Admin API')
  .add(authTrigger).to(authCheck).to(respondAuth)
  .add(configTrigger).to(configAuth).to(fetchConfig).to(assembleConfig).to(respondConfig)
  .add(tvCommandTrigger).to(tvCommandAuth).to(saveCommand).to(respondTvCommand)
  .add(tvScheduleTrigger).to(tvScheduleAuth).to(saveTvSchedule).to(respondTvSchedule)
  .add(tonightTrigger).to(tonightAuth).to(saveTonightOverride).to(respondTonight)
  .add(slidesTrigger).to(slidesAuth).to(saveSlidesConfig).to(respondSlides)
  .add(membersListTrigger).to(membersListAuth).to(selectMembers).to(respondMembersList)
  .add(membersAddTrigger).to(membersAddAuth).to(insertMember).to(respondMembersAdd)
  .add(membersDeleteTrigger).to(membersDeleteAuth).to(deleteMember).to(respondMembersDelete)
  .add(publicConfigTrigger).to(fetchPublicConfig).to(respondPublicConfig).to(respondPublicConfigWebhook)
  .add(piPollTrigger).to(fetchPiCommands).to(shapePiResponse).to(respondPiPoll)
  .add(piAckTrigger).to(clearPiCommand).to(respondPiAck);
