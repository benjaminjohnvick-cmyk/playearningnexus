import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Server-authoritative user-to-user STORE-CREDIT transfer (closed-loop platform credit, not
// cash). Both sides move on the server: debit sender, credit receiver, record the transfer.
// The client can no longer write balances directly, so this is the only path for a transfer.
//
// COMPLIANCE: user-to-user value transfer can raise money-transmitter/stored-value questions
// even for closed-loop credit (see COMPLIANCE-AND-ASSUMPTIONS). Keep limits + terms; have
// counsel confirm before enabling at scale.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sender = await base44.auth.me();
    if (!sender) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const amount = Math.round((Number(body.amount) || 0) * 100) / 100;
    const receiverId = String(body.receiver_user_id || "");
    const note = body.note ? String(body.note) : "";
    if (amount <= 0) return Response.json({ error: "Invalid amount" }, { status: 400 });
    if (!receiverId || receiverId === sender.id) return Response.json({ error: "Invalid recipient" }, { status: 400 });

    const senderBalance = Number(sender.current_balance ?? 0);
    if (senderBalance < amount) return Response.json({ error: "Insufficient balance", required: amount, balance: senderBalance }, { status: 402 });

    const receiver = await base44.asServiceRole.entities.User.get(receiverId);
    if (!receiver) return Response.json({ error: "Recipient not found" }, { status: 404 });

    // Move the credit on the server (both sides).
    await base44.asServiceRole.entities.User.update(sender.id, { current_balance: Math.round((senderBalance - amount) * 100) / 100 });
    await base44.asServiceRole.entities.User.update(receiverId, { current_balance: Math.round(((Number(receiver.current_balance ?? 0)) + amount) * 100) / 100 });

    await base44.asServiceRole.entities.MoneyTransfer.create({
      sender_user_id: sender.id, receiver_user_id: receiverId, receiver_email: receiver.email,
      amount, status: "completed", note, at: new Date().toISOString(),
    });

    return Response.json({ ok: true, transferred: amount, new_balance: Math.round((senderBalance - amount) * 100) / 100 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
