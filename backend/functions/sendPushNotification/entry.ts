import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user_id, title, body, tag, url } = await req.json();

    // Validate admin or self
    if (user.id !== user_id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get active subscriptions
    const subscriptions = await base44.asServiceRole.entities.PushSubscription.filter({
      user_id,
      is_active: true
    });

    if (subscriptions.length === 0) {
      return Response.json({ message: 'No active subscriptions' });
    }

    const results = await Promise.allSettled(
      subscriptions.map(sub =>
        sendWebPush(sub, {
          title,
          body,
          tag,
          data: { url }
        })
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return Response.json({
      sent: successful,
      failed,
      total: subscriptions.length
    });
  } catch (error) {
    console.error('Push notification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function sendWebPush(subscription, payload) {
  // Web Push Protocol implementation
  // This is a simplified version - in production use web-push library
  
  const message = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json',
    'TTL': '24',
  };

  // Add VAPID headers if available
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    const vapidHeaders = generateVAPIDHeaders(subscription.endpoint);
    Object.assign(headers, vapidHeaders);
  }

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers,
    body: message,
  });

  if (!response.ok) {
    throw new Error(`Push failed: ${response.status}`);
  }

  return response;
}

function generateVAPIDHeaders(endpoint) {
  // Simplified - in production use proper JWT library
  return {
    'Authorization': `vapid t=${VAPID_PRIVATE_KEY},k=${VAPID_PUBLIC_KEY}`,
  };
}