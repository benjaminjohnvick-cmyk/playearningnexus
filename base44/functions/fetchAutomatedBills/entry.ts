import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // In production, integrate with Plaid, Open Banking APIs, or email parsing
    // For now, simulate fetching from email summaries or bank connections
    
    const recurringBills = [
      {
        name: 'Netflix',
        amount: 15.99,
        due_date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
        frequency: 'monthly',
        category: 'entertainment',
      },
      {
        name: 'Spotify',
        amount: 11.99,
        due_date: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString().split('T')[0],
        frequency: 'monthly',
        category: 'entertainment',
      },
      {
        name: 'Utilities',
        amount: 120,
        due_date: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString().split('T')[0],
        frequency: 'monthly',
        category: 'utilities',
      },
    ];

    // Cache bills in user's session or database
    await base44.auth.updateMe({
      recurring_bills_cache: JSON.stringify(recurringBills),
      bills_last_fetched: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      bills_found: recurringBills.length,
      bills: recurringBills,
      total_monthly: recurringBills.reduce((sum, b) => sum + b.amount, 0),
    });
  } catch (error) {
    console.error('Bill fetching error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});