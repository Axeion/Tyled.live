// checkin-handler
// Trigger: POST /webhook/tyled/checkin  (from check-in PWA)
// Also serves GET /webhook/tyled/attendees for the display app
//
// Credentials to configure in n8n:
//   - "Tyled Postgres" → Postgres connection to Neon
//   - "Discord Bot"    → discordBotApi (bot token)
//
// Replace placeholder IDs:
//   000000000000000000 → your Discord Guild ID
//   000000000000000001 → #check-ins channel ID

import { workflow, node, trigger, newCredential, expr } from '@n8n/workflow-sdk';

const checkinWebhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'POST Checkin Webhook',
    parameters: {
      httpMethod: 'POST',
      path: 'tyled/checkin',
      responseMode: 'responseNode'
    },
    position: [240, 300]
  },
  output: [{ body: { name: 'John Doe', avatarUrl: 'https://example.com/avatar.jpg' } }]
});

const upsertCheckin = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Upsert Checkin',
    parameters: {
      operation: 'executeQuery',
      query: 'INSERT INTO tyled_checkins (name, avatar_url, event_date, checked_in_at) VALUES ($1, $2, CURRENT_DATE, NOW()) ON CONFLICT (name, event_date) DO UPDATE SET avatar_url = EXCLUDED.avatar_url, checked_in_at = NOW() RETURNING id, name, avatar_url, event_date, checked_in_at',
      options: {
        queryReplacement: expr('{{ $json.body.name + "," + ($json.body.avatarUrl || "") }}')
      }
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 300]
  },
  output: [{ id: 1, name: 'John Doe', avatar_url: '', event_date: '2024-01-01', checked_in_at: '2024-01-01T00:00:00Z' }]
});

const lookupMemberRole = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Lookup Member Role',
    parameters: {
      operation: 'executeQuery',
      query: "SELECT COALESCE((SELECT role FROM lodge_members WHERE LOWER(name) = LOWER($1) LIMIT 1), 'Brother') AS role",
      options: {
        queryReplacement: expr('{{ $("POST Checkin Webhook").item.json.body.name }}')
      }
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [720, 300]
  },
  output: [{ role: 'Master Mason' }]
});

const discordCheckinPost = node({
  type: 'n8n-nodes-base.discord',
  version: 2,
  config: {
    name: 'Discord Checkin Notification',
    parameters: {
      resource: 'message',
      operation: 'send',
      authentication: 'botToken',
      guildId: { __rl: true, mode: 'id', value: '000000000000000000' },
      sendTo: 'channel',
      channelId: { __rl: true, mode: 'id', value: '000000000000000001' },
      content: expr('{{ $("POST Checkin Webhook").item.json.body.name + " (" + ($json.role || "Guest") + ") has checked in." }}')
    },
    credentials: { discordBotApi: newCredential('Discord Bot') },
    position: [960, 300]
  },
  output: [{ id: 'msg1' }]
});

const respondCheckin = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Checkin Success',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ { success: true, name: $("POST Checkin Webhook").item.json.body.name, role: $("Lookup Member Role").item.json.role || "Brother" } }}')
    },
    position: [1200, 300]
  },
  output: [{}]
});

const attendeesWebhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'GET Attendees Webhook',
    parameters: {
      httpMethod: 'GET',
      path: 'tyled/attendees',
      responseMode: 'responseNode'
    },
    position: [240, 600]
  },
  output: [{}]
});

const selectTodayCheckins = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Select Today Checkins',
    parameters: {
      operation: 'executeQuery',
      query: `SELECT
        c.name,
        COALESCE(m.role, 'Brother') AS role,
        c.avatar_url AS "avatarUrl",
        c.checked_in_at AS "checkedInAt"
      FROM tyled_checkins c
      LEFT JOIN lodge_members m ON LOWER(c.name) = LOWER(m.name)
      WHERE c.event_date = CURRENT_DATE
      ORDER BY c.checked_in_at ASC`
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 600]
  },
  output: [{ name: 'John Doe', role: 'Master Mason', avatarUrl: '', checkedInAt: '2024-01-01T00:00:00Z' }]
});

const respondAttendees = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Attendees Array',
    parameters: {
      respondWith: 'allIncomingItems'
    },
    position: [720, 600]
  },
  output: [{}]
});

// GET /webhook/tyled/members — used by the check-in PWA for autocomplete
const membersWebhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'GET Members Webhook',
    parameters: {
      httpMethod: 'GET',
      path: 'tyled/members',
      responseMode: 'responseNode'
    },
    position: [240, 900]
  },
  output: [{}]
});

const selectActiveMembers = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Select Active Members',
    parameters: {
      operation: 'executeQuery',
      query: 'SELECT name, role FROM lodge_members WHERE active = TRUE ORDER BY name ASC'
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 900]
  },
  output: [{ name: 'John Doe', role: 'Master Mason' }]
});

const respondMembers = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Members Array',
    parameters: {
      respondWith: 'allIncomingItems'
    },
    position: [720, 900]
  },
  output: [{}]
});

export default workflow('checkin-handler', 'Check-In Handler')
  .add(checkinWebhookTrigger)
  .to(upsertCheckin)
  .to(lookupMemberRole)
  .to(discordCheckinPost)
  .to(respondCheckin)
  .add(attendeesWebhookTrigger)
  .to(selectTodayCheckins)
  .to(respondAttendees)
  .add(membersWebhookTrigger)
  .to(selectActiveMembers)
  .to(respondMembers);
