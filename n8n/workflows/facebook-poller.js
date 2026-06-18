// facebook-poller
// Trigger: Schedule every 15 minutes
// Also serves GET /webhook/tyled/photos for the display app
//
// Credentials to configure in n8n:
//   - "Facebook Access Token" → httpQueryAuth, param name: access_token
//   - "Tyled Postgres"        → Postgres connection to Neon
//
// Variables to configure in n8n:
//   - FACEBOOK_PAGE_ID → your Facebook Page's numeric ID
//
// Note: Long-lived Page access tokens expire every 60 days.
// Set a calendar reminder or configure a System User token for indefinite access.

import { workflow, node, trigger, newCredential, expr } from '@n8n/workflow-sdk';

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every 15 Minutes',
    parameters: {
      rule: {
        interval: [{ field: 'minutes', minutesInterval: 15 }]
      }
    },
    position: [240, 300]
  },
  output: [{}]
});

const fetchFacebookPosts = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Fetch Facebook Posts',
    parameters: {
      method: 'GET',
      url: expr('{{ "https://graph.facebook.com/v19.0/" + $vars.FACEBOOK_PAGE_ID + "/posts" }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpQueryAuth',
      credentials: { httpQueryAuth: newCredential('Facebook Access Token') },
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: {
        parameters: [
          { name: 'fields', value: 'id,message,full_picture,permalink_url,created_time,reactions.summary(true)' },
          { name: 'limit', value: '10' }
        ]
      }
    },
    position: [480, 300]
  },
  output: [{ data: [{ id: '1', message: 'Post', full_picture: 'https://example.com/img.jpg', permalink_url: 'https://fb.com/post', created_time: '2024-01-01T00:00:00Z', reactions: { summary: { total_count: 5 } } }] }]
});

const filterAndShapePosts = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Filter and Shape Posts',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const data = $input.first().json.data || [];
const withImages = data.filter(p => p.full_picture);
const top2 = withImages.slice(0, 2);
return top2.map(p => ({
  json: {
    image_url: p.full_picture,
    caption: (p.message || '').substring(0, 200),
    post_url: p.permalink_url,
    date: new Date(p.created_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    likes: p.reactions?.summary?.total_count || 0
  }
}));`
    },
    position: [720, 300]
  },
  output: [{ image_url: 'https://example.com/img.jpg', caption: 'Post', post_url: 'https://fb.com/post', date: 'Jan 1, 2024', likes: 5 }]
});

const deletePhotos = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Delete All Photos',
    parameters: {
      operation: 'deleteTable',
      schema: { __rl: true, mode: 'name', value: 'public' },
      table: { __rl: true, mode: 'name', value: 'tyled_photos' },
      deleteCommand: 'truncate'
    },
    executeOnce: true,
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [960, 300]
  },
  output: [{}]
});

const insertPhotos = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Insert Photos',
    parameters: {
      operation: 'insert',
      schema: { __rl: true, mode: 'name', value: 'public' },
      table: { __rl: true, mode: 'name', value: 'tyled_photos' },
      columns: expr('={{ "image_url,caption,post_url,date,likes" }}')
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [1200, 300]
  },
  output: [{ id: 1 }]
});

const photosWebhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'GET Photos Webhook',
    parameters: {
      httpMethod: 'GET',
      path: 'tyled/photos',
      responseMode: 'responseNode'
    },
    position: [240, 600]
  },
  output: [{}]
});

const selectAllPhotos = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Select All Photos',
    parameters: {
      operation: 'executeQuery',
      query: 'SELECT image_url AS "imageUrl", caption, post_url AS "postUrl", date, likes FROM tyled_photos ORDER BY id ASC'
    },
    credentials: { postgres: newCredential('Tyled Postgres') },
    position: [480, 600]
  },
  output: [{ imageUrl: 'https://example.com/img.jpg', caption: 'Post' }]
});

const respondPhotos = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Photos Array',
    parameters: {
      respondWith: 'allIncomingItems'
    },
    position: [720, 600]
  },
  output: [{}]
});

export default workflow('facebook-poller', 'Facebook Photo Poller')
  .add(scheduleTrigger)
  .to(fetchFacebookPosts)
  .to(filterAndShapePosts)
  .to(deletePhotos)
  .to(insertPhotos)
  .add(photosWebhookTrigger)
  .to(selectAllPhotos)
  .to(respondPhotos);
