// admin-api
// All admin panel endpoints + public config endpoint + Pi polling endpoint.
//
// Auth: reads password from tyled_config table (key = 'admin_password').
// POST requests include { token } in body; token is compared to stored value.
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

import { workflow, node, trigger, newCredential, ifElse, expr } from '@n8n/workflow-sdk';

const PW_QUERY = "SELECT value FROM tyled_config WHERE key = 'admin_password' LIMIT 1";

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

const fetchPwAuth = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch PW Auth',
    parameters: { operation: 'executeQuery', query: PW_QUERY },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 100]
  },
  output: [{ value: 'secret' }]
});

const authIF = ifElse({
  version: 2.2,
  config: {
    name: 'Auth Check',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        combinator: 'and',
        conditions: [{
          id: 'a',
          operator: { type: 'string', operation: 'equals' },
          leftValue: expr('{{ $("POST Auth").first().json.body?.token }}'),
          rightValue: expr('{{ $json.value }}')
        }]
      }
    },
    position: [720, 100]
  }
});

const respondAuthOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Auth OK',
    parameters: { respondWith: 'json', responseBody: { ok: true } },
    position: [960, 40]
  },
  output: [{}]
});

const respondAuthFail = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Auth Fail',
    parameters: { respondWith: 'json', responseBody: { ok: false, error: 'Unauthorized' } },
    position: [960, 160]
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
    position: [240, 400]
  },
  output: [{ body: { token: 'secret' } }]
});

const fetchPwConfig = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch PW Config',
    parameters: { operation: 'executeQuery', query: PW_QUERY },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 400]
  },
  output: [{ value: 'secret' }]
});

const configIF = ifElse({
  version: 2.2,
  config: {
    name: 'Config Auth',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        combinator: 'and',
        conditions: [{
          id: 'a',
          operator: { type: 'string', operation: 'equals' },
          leftValue: expr('{{ $("POST Config").first().json.body?.token }}'),
          rightValue: expr('{{ $json.value }}')
        }]
      }
    },
    position: [720, 400]
  }
});

const fetchConfig = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch All Config',
    parameters: {
      operation: 'executeQuery',
      query: "SELECT key, value FROM tyled_config WHERE key IN ('tv_schedule','tv_pending_command','tonight_override','slide_config')"
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [960, 340]
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
      jsCode: `const rows = $input.all();
const map = {};
rows.forEach(r => { map[r.json.key] = r.json.value; });
return [{
  json: {
    tv: { schedule: map['tv_schedule'] || {}, pendingCommand: map['tv_pending_command'] || null },
    tonight: map['tonight_override'] || { active: false },
    slides: map['slide_config'] || { home: true, events: true, photos: true, attendees: true, minutes: true }
  }
}];`
    },
    position: [1200, 340]
  },
  output: [{ tv: {}, tonight: {}, slides: {} }]
});

const respondConfig = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Config',
    parameters: { respondWith: 'firstIncomingItem' },
    position: [1440, 340]
  },
  output: [{}]
});

const respondConfigUnauth = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Config Unauth',
    parameters: { respondWith: 'json', responseBody: { ok: false, error: 'Unauthorized' } },
    position: [960, 460]
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
    position: [240, 700]
  },
  output: [{ body: { token: 'secret', action: 'on' } }]
});

const fetchPwTvCmd = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch PW TV Cmd',
    parameters: { operation: 'executeQuery', query: PW_QUERY },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 700]
  },
  output: [{ value: 'secret' }]
});

const tvCmdIF = ifElse({
  version: 2.2,
  config: {
    name: 'TV Cmd Auth',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        combinator: 'and',
        conditions: [{
          id: 'a',
          operator: { type: 'string', operation: 'equals' },
          leftValue: expr('{{ $("POST TV Command").first().json.body?.token }}'),
          rightValue: expr('{{ $json.value }}')
        }]
      }
    },
    position: [720, 700]
  }
});

const extractTvCmd = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extract TV Cmd',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `return [{ json: $('POST TV Command').first().json.body }];`
    },
    position: [960, 640]
  },
  output: [{ action: 'on' }]
});

const saveCommand = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save TV Command',
    parameters: {
      operation: 'executeQuery',
      query: `INSERT INTO tyled_config (key, value, updated_at) VALUES ('tv_pending_command', $1::jsonb, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      options: { queryReplacement: expr('{{ JSON.stringify({ action: $json.action, issuedAt: new Date().toISOString() }) }}') }
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [1200, 640]
  },
  output: [{}]
});

const respondTvCommand = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond TV Command',
    parameters: { respondWith: 'json', responseBody: { ok: true, message: 'Command queued' } },
    position: [1440, 640]
  },
  output: [{}]
});

const respondTvCmdUnauth = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond TV Cmd Unauth',
    parameters: { respondWith: 'json', responseBody: { ok: false, error: 'Unauthorized' } },
    position: [960, 760]
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
    position: [240, 1000]
  },
  output: [{ body: { token: 'secret', schedule: {} } }]
});

const fetchPwTvSched = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch PW TV Sched',
    parameters: { operation: 'executeQuery', query: PW_QUERY },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 1000]
  },
  output: [{ value: 'secret' }]
});

const tvSchedIF = ifElse({
  version: 2.2,
  config: {
    name: 'TV Sched Auth',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        combinator: 'and',
        conditions: [{
          id: 'a',
          operator: { type: 'string', operation: 'equals' },
          leftValue: expr('{{ $("POST TV Schedule").first().json.body?.token }}'),
          rightValue: expr('{{ $json.value }}')
        }]
      }
    },
    position: [720, 1000]
  }
});

const extractTvSched = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extract TV Sched',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `return [{ json: $('POST TV Schedule').first().json.body }];`
    },
    position: [960, 940]
  },
  output: [{ schedule: {} }]
});

const saveTvSchedule = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save TV Schedule',
    parameters: {
      operation: 'executeQuery',
      query: `INSERT INTO tyled_config (key, value, updated_at) VALUES ('tv_schedule', $1::jsonb, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      options: { queryReplacement: expr('{{ JSON.stringify($json.schedule) }}') }
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [1200, 940]
  },
  output: [{}]
});

const respondTvSchedule = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond TV Schedule',
    parameters: { respondWith: 'json', responseBody: { ok: true } },
    position: [1440, 940]
  },
  output: [{}]
});

const respondTvSchedUnauth = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond TV Sched Unauth',
    parameters: { respondWith: 'json', responseBody: { ok: false, error: 'Unauthorized' } },
    position: [960, 1060]
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
    position: [240, 1300]
  },
  output: [{ body: { token: 'secret', override: {} } }]
});

const fetchPwTonight = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch PW Tonight',
    parameters: { operation: 'executeQuery', query: PW_QUERY },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 1300]
  },
  output: [{ value: 'secret' }]
});

const tonightIF = ifElse({
  version: 2.2,
  config: {
    name: 'Tonight Auth',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        combinator: 'and',
        conditions: [{
          id: 'a',
          operator: { type: 'string', operation: 'equals' },
          leftValue: expr('{{ $("POST Tonight Override").first().json.body?.token }}'),
          rightValue: expr('{{ $json.value }}')
        }]
      }
    },
    position: [720, 1300]
  }
});

const extractTonight = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extract Tonight',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `return [{ json: $('POST Tonight Override').first().json.body }];`
    },
    position: [960, 1240]
  },
  output: [{ override: {} }]
});

const saveTonightOverride = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save Tonight Override',
    parameters: {
      operation: 'executeQuery',
      query: `INSERT INTO tyled_config (key, value, updated_at) VALUES ('tonight_override', $1::jsonb, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      options: { queryReplacement: expr('{{ JSON.stringify($json.override) }}') }
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [1200, 1240]
  },
  output: [{}]
});

const respondTonight = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Tonight',
    parameters: { respondWith: 'json', responseBody: { ok: true } },
    position: [1440, 1240]
  },
  output: [{}]
});

const respondTonightUnauth = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Tonight Unauth',
    parameters: { respondWith: 'json', responseBody: { ok: false, error: 'Unauthorized' } },
    position: [960, 1360]
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
    position: [240, 1600]
  },
  output: [{ body: { token: 'secret', slides: {} } }]
});

const fetchPwSlides = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch PW Slides',
    parameters: { operation: 'executeQuery', query: PW_QUERY },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 1600]
  },
  output: [{ value: 'secret' }]
});

const slidesIF = ifElse({
  version: 2.2,
  config: {
    name: 'Slides Auth',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        combinator: 'and',
        conditions: [{
          id: 'a',
          operator: { type: 'string', operation: 'equals' },
          leftValue: expr('{{ $("POST Slides Config").first().json.body?.token }}'),
          rightValue: expr('{{ $json.value }}')
        }]
      }
    },
    position: [720, 1600]
  }
});

const extractSlides = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extract Slides',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `return [{ json: $('POST Slides Config').first().json.body }];`
    },
    position: [960, 1540]
  },
  output: [{ slides: {} }]
});

const saveSlidesConfig = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save Slides Config',
    parameters: {
      operation: 'executeQuery',
      query: `INSERT INTO tyled_config (key, value, updated_at) VALUES ('slide_config', $1::jsonb, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      options: { queryReplacement: expr('{{ JSON.stringify($json.slides) }}') }
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [1200, 1540]
  },
  output: [{}]
});

const respondSlides = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Slides',
    parameters: { respondWith: 'json', responseBody: { ok: true } },
    position: [1440, 1540]
  },
  output: [{}]
});

const respondSlidesUnauth = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Slides Unauth',
    parameters: { respondWith: 'json', responseBody: { ok: false, error: 'Unauthorized' } },
    position: [960, 1660]
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
    position: [240, 1900]
  },
  output: [{ body: { token: 'secret' } }]
});

const fetchPwMembersList = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch PW Members List',
    parameters: { operation: 'executeQuery', query: PW_QUERY },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 1900]
  },
  output: [{ value: 'secret' }]
});

const membersListIF = ifElse({
  version: 2.2,
  config: {
    name: 'Members List Auth',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        combinator: 'and',
        conditions: [{
          id: 'a',
          operator: { type: 'string', operation: 'equals' },
          leftValue: expr('{{ $("POST Members List").first().json.body?.token }}'),
          rightValue: expr('{{ $json.value }}')
        }]
      }
    },
    position: [720, 1900]
  }
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
    position: [960, 1840]
  },
  output: [{ id: 1, name: 'John Doe', role: 'Master Mason' }]
});

const respondMembersList = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Members List',
    parameters: { respondWith: 'allIncomingItems' },
    position: [1200, 1840]
  },
  output: [{}]
});

const respondMembersListUnauth = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Members List Unauth',
    parameters: { respondWith: 'json', responseBody: { ok: false, error: 'Unauthorized' } },
    position: [960, 1960]
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
    position: [240, 2200]
  },
  output: [{ body: { token: 'secret', name: 'John', role: 'Master Mason', email: '' } }]
});

const fetchPwMembersAdd = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch PW Members Add',
    parameters: { operation: 'executeQuery', query: PW_QUERY },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 2200]
  },
  output: [{ value: 'secret' }]
});

const membersAddIF = ifElse({
  version: 2.2,
  config: {
    name: 'Members Add Auth',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        combinator: 'and',
        conditions: [{
          id: 'a',
          operator: { type: 'string', operation: 'equals' },
          leftValue: expr('{{ $("POST Members Add").first().json.body?.token }}'),
          rightValue: expr('{{ $json.value }}')
        }]
      }
    },
    position: [720, 2200]
  }
});

const extractMembersAdd = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extract Members Add',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `return [{ json: $('POST Members Add').first().json.body }];`
    },
    position: [960, 2140]
  },
  output: [{ name: 'John', role: 'Master Mason', email: '' }]
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
    position: [1200, 2140]
  },
  output: [{ id: 1, name: 'John', role: 'Master Mason' }]
});

const respondMembersAdd = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Members Add',
    parameters: { respondWith: 'firstIncomingItem' },
    position: [1440, 2140]
  },
  output: [{}]
});

const respondMembersAddUnauth = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Members Add Unauth',
    parameters: { respondWith: 'json', responseBody: { ok: false, error: 'Unauthorized' } },
    position: [960, 2260]
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
    position: [240, 2500]
  },
  output: [{ body: { token: 'secret', id: 1 } }]
});

const fetchPwMembersDelete = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch PW Members Delete',
    parameters: { operation: 'executeQuery', query: PW_QUERY },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 2500]
  },
  output: [{ value: 'secret' }]
});

const membersDeleteIF = ifElse({
  version: 2.2,
  config: {
    name: 'Members Delete Auth',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        combinator: 'and',
        conditions: [{
          id: 'a',
          operator: { type: 'string', operation: 'equals' },
          leftValue: expr('{{ $("POST Members Delete").first().json.body?.token }}'),
          rightValue: expr('{{ $json.value }}')
        }]
      }
    },
    position: [720, 2500]
  }
});

const extractMembersDelete = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extract Members Delete',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `return [{ json: $('POST Members Delete').first().json.body }];`
    },
    position: [960, 2440]
  },
  output: [{ id: 1 }]
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
    position: [1200, 2440]
  },
  output: [{ id: 1 }]
});

const respondMembersDelete = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Members Delete',
    parameters: { respondWith: 'json', responseBody: { ok: true } },
    position: [1440, 2440]
  },
  output: [{}]
});

const respondMembersDeleteUnauth = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Members Delete Unauth',
    parameters: { respondWith: 'json', responseBody: { ok: false, error: 'Unauthorized' } },
    position: [960, 2560]
  },
  output: [{}]
});

// ── GET /webhook/tyled/config (public) ────────────────────────────────────────
const publicConfigTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'GET Public Config',
    parameters: { httpMethod: 'GET', path: 'tyled/config', responseMode: 'responseNode' },
    position: [240, 2800]
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
      query: "SELECT value FROM tyled_config WHERE key = 'slide_config'"
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 2800]
  },
  output: [{ value: { home: true, events: true, photos: true, attendees: true, minutes: true } }]
});

const shapePublicConfig = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Shape Public Config',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const row = $input.first().json;
return [{ json: { slides: row.value || { home: true, events: true, photos: true, attendees: true, minutes: true } } }];`
    },
    position: [720, 2800]
  },
  output: [{ slides: {} }]
});

const respondPublicConfigWebhook = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Public Config',
    parameters: { respondWith: 'firstIncomingItem' },
    position: [960, 2800]
  },
  output: [{}]
});

// ── GET /webhook/tyled/pi/poll ────────────────────────────────────────────────
const piPollTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'GET Pi Poll',
    parameters: { httpMethod: 'GET', path: 'tyled/pi/poll', responseMode: 'responseNode' },
    position: [240, 3100]
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
      query: "SELECT key, value FROM tyled_config WHERE key IN ('tv_pending_command', 'tv_schedule')"
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 3100]
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
    position: [720, 3100]
  },
  output: [{ command: null, schedule: {} }]
});

const respondPiPoll = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Pi Poll',
    parameters: { respondWith: 'firstIncomingItem' },
    position: [960, 3100]
  },
  output: [{}]
});

// ── POST /webhook/tyled/pi/ack ────────────────────────────────────────────────
const piAckTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'POST Pi Ack',
    parameters: { httpMethod: 'POST', path: 'tyled/pi/ack', responseMode: 'responseNode' },
    position: [240, 3400]
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
    position: [480, 3400]
  },
  output: [{}]
});

const respondPiAck = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Pi Ack',
    parameters: { respondWith: 'json', responseBody: { ok: true } },
    position: [720, 3400]
  },
  output: [{}]
});

export default workflow('admin-api', 'Admin API')
  .add(authTrigger).to(fetchPwAuth).to(authIF.onTrue(respondAuthOk).onFalse(respondAuthFail))
  .add(configTrigger).to(fetchPwConfig).to(configIF.onTrue(fetchConfig.to(assembleConfig).to(respondConfig)).onFalse(respondConfigUnauth))
  .add(tvCommandTrigger).to(fetchPwTvCmd).to(tvCmdIF.onTrue(extractTvCmd.to(saveCommand).to(respondTvCommand)).onFalse(respondTvCmdUnauth))
  .add(tvScheduleTrigger).to(fetchPwTvSched).to(tvSchedIF.onTrue(extractTvSched.to(saveTvSchedule).to(respondTvSchedule)).onFalse(respondTvSchedUnauth))
  .add(tonightTrigger).to(fetchPwTonight).to(tonightIF.onTrue(extractTonight.to(saveTonightOverride).to(respondTonight)).onFalse(respondTonightUnauth))
  .add(slidesTrigger).to(fetchPwSlides).to(slidesIF.onTrue(extractSlides.to(saveSlidesConfig).to(respondSlides)).onFalse(respondSlidesUnauth))
  .add(membersListTrigger).to(fetchPwMembersList).to(membersListIF.onTrue(selectMembers.to(respondMembersList)).onFalse(respondMembersListUnauth))
  .add(membersAddTrigger).to(fetchPwMembersAdd).to(membersAddIF.onTrue(extractMembersAdd.to(insertMember).to(respondMembersAdd)).onFalse(respondMembersAddUnauth))
  .add(membersDeleteTrigger).to(fetchPwMembersDelete).to(membersDeleteIF.onTrue(extractMembersDelete.to(deleteMember).to(respondMembersDelete)).onFalse(respondMembersDeleteUnauth))
  .add(publicConfigTrigger).to(fetchPublicConfig).to(shapePublicConfig).to(respondPublicConfigWebhook)
  .add(piPollTrigger).to(fetchPiCommands).to(shapePiResponse).to(respondPiPoll)
  .add(piAckTrigger).to(clearPiCommand).to(respondPiAck);
