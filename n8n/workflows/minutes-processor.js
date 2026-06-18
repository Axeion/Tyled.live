// minutes-processor
// Trigger: Discord webhook POST (configure your Discord bot to forward #lodge-minutes messages here)
// Also serves GET /webhook/tyled/minutes for the display app
//
// Credentials to configure in n8n:
//   - "Anthropic API Key"  → httpHeaderAuth, header name: x-api-key
//   - "Tyled Postgres"     → Postgres connection to Neon
//   - "Discord Bot"        → discordBotApi (bot token)
//
// Replace placeholder IDs:
//   000000000000000000 → your Discord Guild ID
//   000000000000000001 → #lodge-minutes channel ID
//   000000000000000002 → #announcements channel ID

import { workflow, node, trigger, newCredential, ifElse, expr } from '@n8n/workflow-sdk';

const discordTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Discord Minutes Webhook',
    parameters: {
      httpMethod: 'POST',
      path: 'discord-minutes',
      responseMode: 'responseNode'
    },
    position: [240, 300]
  },
  output: [{ body: { attachments: [{ url: 'https://cdn.discordapp.com/attachments/123/file.pdf', filename: 'minutes.pdf', content_type: 'application/pdf' }], channel_id: '111', id: '999' } }]
});

const filterPDF = ifElse({
  version: 2.2,
  config: {
    name: 'Is PDF Attachment',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            id: '1',
            leftValue: expr('{{ $json.body.attachments && $json.body.attachments.length > 0 && $json.body.attachments[0].content_type === "application/pdf" }}'),
            rightValue: true,
            operator: { type: 'boolean', operation: 'true' }
          }
        ],
        combinator: 'and'
      }
    },
    position: [480, 300]
  }
});

const ignorePDF = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Ignore Non-PDF',
    parameters: { respondWith: 'json', responseBody: { status: 'ignored' } },
    position: [720, 480]
  },
  output: [{}]
});

const ackWebhook = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Acknowledge Discord',
    parameters: {
      respondWith: 'json',
      responseBody: { status: 'processing' }
    },
    position: [720, 180]
  },
  output: [{ status: 'processing' }]
});

const downloadPDF = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Download PDF',
    parameters: {
      method: 'GET',
      url: expr('{{ $("Discord Minutes Webhook").item.json.body.attachments[0].url }}'),
      options: {
        response: {
          response: {
            responseFormat: 'file',
            outputPropertyName: 'data'
          }
        }
      }
    },
    position: [960, 180]
  },
  output: [{ binary: { data: {} } }]
});

const callClaude = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Call Claude API',
    parameters: {
      method: 'POST',
      url: 'https://api.anthropic.com/v1/messages',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      credentials: { httpHeaderAuth: newCredential('Anthropic API Key') },
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: {
        parameters: [
          { name: 'anthropic-version', value: '2023-06-01' },
          { name: 'content-type', value: 'application/json' }
        ]
      },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2048, messages: [{ role: "user", content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: $binary.data.data } }, { type: "text", text: "Extract meeting minutes. Return JSON only with fields: meeting (string), motions (array of {text, result}), funds (array of {label, amount}), notes (array of strings), parsedAt (ISO timestamp)." }] }] }) }}')
    },
    position: [1200, 180]
  },
  output: [{ content: [{ text: '{"meeting":"Lodge Meeting","motions":[],"funds":[],"notes":[],"parsedAt":"2024-01-01T00:00:00Z"}' }] }]
});

const parseClaudeResponse = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Claude Response',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const item = $input.first();
const responseText = item.json.content[0].text;
let parsed;
try {
  parsed = JSON.parse(responseText);
} catch(e) {
  const match = responseText.match(/\\{[\\s\\S]*\\}/);
  parsed = match ? JSON.parse(match[0]) : { meeting: 'Unknown', motions: [], funds: [], notes: [], parsedAt: new Date().toISOString() };
}
parsed.source_message = $('Discord Minutes Webhook').first().json.body.id;
return [{ json: parsed }];`
    },
    position: [1440, 180]
  },
  output: [{ meeting: 'Lodge Meeting', motions: [], funds: [], notes: [], parsedAt: '2024-01-01T00:00:00Z', source_message: '999' }]
});

const upsertMinutes = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Upsert Minutes',
    parameters: {
      operation: 'executeQuery',
      query: 'INSERT INTO tyled_minutes (source_message, meeting, motions, funds, notes, parsed_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (source_message) DO UPDATE SET meeting = EXCLUDED.meeting, motions = EXCLUDED.motions, funds = EXCLUDED.funds, notes = EXCLUDED.notes, parsed_at = EXCLUDED.parsed_at RETURNING *',
      options: {
        queryReplacement: expr('{{ $json.source_message + "," + $json.meeting + "," + JSON.stringify($json.motions) + "," + JSON.stringify($json.funds) + "," + JSON.stringify($json.notes) + "," + $json.parsedAt }}')
      }
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [1680, 180]
  },
  output: [{ id: 1, meeting: 'Lodge Meeting', source_message: '999' }]
});

const discordSuccessPost = node({
  type: 'n8n-nodes-base.discord',
  version: 2,
  config: {
    name: 'Discord Success to lodge-minutes',
    parameters: {
      resource: 'message',
      operation: 'send',
      authentication: 'botToken',
      guildId: { __rl: true, mode: 'id', value: '000000000000000000' },
      sendTo: 'channel',
      channelId: { __rl: true, mode: 'id', value: '000000000000000001' },
      content: expr('{{ "Minutes processed for: " + $("Parse Claude Response").item.json.meeting }}')
    },
    credentials: { discordBotApi: newCredential('Discord Bot') },
    position: [1920, 180]
  },
  output: [{ id: 'msg1' }]
});

const discordBriefPost = node({
  type: 'n8n-nodes-base.discord',
  version: 2,
  config: {
    name: 'Discord Brief to announcements',
    parameters: {
      resource: 'message',
      operation: 'send',
      authentication: 'botToken',
      guildId: { __rl: true, mode: 'id', value: '000000000000000000' },
      sendTo: 'channel',
      channelId: { __rl: true, mode: 'id', value: '000000000000000002' },
      content: expr('{{ "Meeting minutes available: " + $("Parse Claude Response").item.json.meeting + " — " + $("Parse Claude Response").item.json.motions.length + " motions recorded." }}')
    },
    credentials: { discordBotApi: newCredential('Discord Bot') },
    position: [2160, 180]
  },
  output: [{ id: 'msg2' }]
});

const minutesWebhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'GET Minutes Webhook',
    parameters: {
      httpMethod: 'GET',
      path: 'tyled/minutes',
      responseMode: 'responseNode'
    },
    position: [240, 660]
  },
  output: [{}]
});

const selectLatestMinutes = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Select Latest Minutes',
    parameters: {
      operation: 'executeQuery',
      query: 'SELECT * FROM tyled_minutes ORDER BY parsed_at DESC LIMIT 1'
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 660]
  },
  output: [{ id: 1, meeting: 'Lodge Meeting' }]
});

const respondMinutes = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Minutes JSON',
    parameters: {
      respondWith: 'firstIncomingItem'
    },
    position: [720, 660]
  },
  output: [{ id: 1, meeting: 'Lodge Meeting' }]
});

export default workflow('minutes-processor', 'Minutes Processor')
  .add(discordTrigger)
  .to(filterPDF
    .onTrue(ackWebhook.to(downloadPDF.to(callClaude.to(parseClaudeResponse.to(upsertMinutes.to(discordSuccessPost.to(discordBriefPost)))))))
    .onFalse(ignorePDF))
  .add(minutesWebhookTrigger)
  .to(selectLatestMinutes)
  .to(respondMinutes);
