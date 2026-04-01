import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const CPI_COST = 6; // $6 per install

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { appId, developerId } = await req.json();

    if (!appId || !developerId) {
      return Response.json({ error: 'Missing appId or developerId' }, { status: 400 });
    }

    // Get or create developer install cost record
    let cpiRecord = null;
    try {
      const existing = await base44.asServiceRole.entities.DeveloperInstallCost.filter({
        developer_id: developerId,
        app_id: appId
      });
      cpiRecord = existing[0];
    } catch (e) {
      cpiRecord = null;
    }

    if (!cpiRecord) {
      cpiRecord = await base44.asServiceRole.entities.DeveloperInstallCost.create({
        developer_id: developerId,
        app_id: appId,
        cpi_cost: CPI_COST,
        total_installs: 0,
        total_cpi_spent: 0
      });
    }

    // Check if developer has budget remaining
    const budgetRemaining = cpiRecord.budget_remaining || cpiRecord.monthly_budget || Infinity;
    
    if (budgetRemaining < CPI_COST) {
      // Out of budget
      await base44.asServiceRole.entities.DeveloperInstallCost.update(cpiRecord.id, {
        status: 'out_of_budget'
      });

      return Response.json({
        success: false,
        reason: 'out_of_budget',
        message: `Insufficient CPI budget. Need $${CPI_COST}, available: $${budgetRemaining.toFixed(2)}`,
        install_charged: false
      });
    }

    // Charge the CPI cost
    const newTotalInstalls = (cpiRecord.total_installs || 0) + 1;
    const newTotalSpent = (cpiRecord.total_cpi_spent || 0) + CPI_COST;
    const newMonthlySpent = (cpiRecord.monthly_spent || 0) + CPI_COST;
    const newBudgetRemaining = budgetRemaining - CPI_COST;

    await base44.asServiceRole.entities.DeveloperInstallCost.update(cpiRecord.id, {
      total_installs: newTotalInstalls,
      total_cpi_spent: newTotalSpent,
      monthly_spent: newMonthlySpent,
      budget_remaining: newBudgetRemaining,
      last_install_at: new Date().toISOString(),
      status: newBudgetRemaining <= 0 && !cpiRecord.auto_recharge_enabled ? 'out_of_budget' : 'active'
    });

    return Response.json({
      success: true,
      install_charged: true,
      cpi_cost: CPI_COST,
      total_installs: newTotalInstalls,
      total_cpi_spent: newTotalSpent,
      budget_remaining: newBudgetRemaining,
      message: `CPI charge of $${CPI_COST} processed. Total installs: ${newTotalInstalls}, Spent: $${newTotalSpent.toFixed(2)}`
    });

  } catch (error) {
    console.error('Error in chargeInstallCPI:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});