import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all active email sequences
    const activeSequences = await base44.entities.EmailSequence.filter({ 
      status: 'active' 
    });

    if (!activeSequences || activeSequences.length === 0) {
      return Response.json({ 
        message: 'No active sequences to process',
        processed: 0
      });
    }

    const now = new Date();
    let processedCount = 0;
    const results = [];

    for (const sequence of activeSequences) {
      try {
        const prospect = await base44.entities.CRMProspect.list();
        const matchedProspect = prospect.find(p => p.id === sequence.prospect_id);

        if (!matchedProspect) {
          console.log(`Prospect ${sequence.prospect_id} not found for sequence ${sequence.id}`);
          continue;
        }

        // Check if current step should be sent
        const currentStepData = sequence.steps[sequence.current_step - 1];
        if (!currentStepData || currentStepData.status !== 'pending') {
          continue;
        }

        // Calculate when this step should be sent
        let lastEmailDate = new Date(sequence.started_date);
        if (sequence.last_email_sent_date) {
          lastEmailDate = new Date(sequence.last_email_sent_date);
        }

        const dueDate = new Date(lastEmailDate);
        dueDate.setDate(dueDate.getDate() + currentStepData.delay_days);

        // Only send if due date has passed
        if (dueDate > now) {
          continue;
        }

        // Send email using Core.SendEmail integration
        await base44.integrations.Core.SendEmail({
          to: matchedProspect.contact_email,
          subject: currentStepData.subject_line,
          body: currentStepData.email_body,
          from_name: user.full_name || 'Sales Team'
        });

        // Update the step status
        currentStepData.status = 'sent';
        currentStepData.sent_date = new Date().toISOString();

        // Check if there's a next step
        const isLastStep = sequence.current_step === sequence.total_steps;
        const newStatus = isLastStep ? 'completed' : 'active';

        // Update the sequence
        await base44.entities.EmailSequence.update(sequence.id, {
          current_step: isLastStep ? sequence.current_step : sequence.current_step + 1,
          steps: sequence.steps,
          last_email_sent_date: new Date().toISOString(),
          status: newStatus
        });

        results.push({
          sequence_id: sequence.id,
          prospect_email: matchedProspect.contact_email,
          step_sent: sequence.current_step,
          status: 'sent',
          next_status: newStatus
        });

        processedCount++;
      } catch (stepError) {
        console.error(`Error processing sequence ${sequence.id}:`, stepError);
        results.push({
          sequence_id: sequence.id,
          status: 'error',
          error: stepError.message
        });
      }
    }

    return Response.json({
      message: 'Drip sequences processed',
      processed: processedCount,
      total: activeSequences.length,
      results: results
    });
  } catch (error) {
    console.error('Drip sequence processor error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});