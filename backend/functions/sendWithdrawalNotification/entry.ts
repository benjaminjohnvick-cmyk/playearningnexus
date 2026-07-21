import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { event, data, old_data } = payload;

    // Only trigger when status changes TO 'completed'
    if (!data || data.status !== 'completed') {
      return Response.json({ ok: true, message: 'Not a completion event' });
    }
    if (old_data && old_data.status === 'completed') {
      return Response.json({ ok: true, message: 'Already completed' });
    }

    // Find the user
    const userId = data.user_id || data.recipient_id;
    if (!userId) return Response.json({ ok: true, message: 'No user_id on payout' });

    const allUsers = await base44.asServiceRole.entities.User.list();
    const user = allUsers.find(u => u.id === userId);
    if (!user?.email) return Response.json({ ok: true, message: 'User not found' });

    const amount = (data.amount || 0).toFixed(2);
    const method = (data.method || 'payout').toUpperCase();

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      subject: `✅ Your $${amount} withdrawal is complete!`,
      body: `Hi ${user.full_name || 'there'},\n\nGreat news! Your withdrawal of $${amount} via ${method} has been processed and is on its way to you.\n\nTransaction ID: ${data.id || 'N/A'}\nAmount: $${amount}\nMethod: ${method}\n\nThank you for using GamerGain!\n\n— The GamerGain Team`,
    });

    return Response.json({ ok: true, message: `Email sent to ${user.email}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});