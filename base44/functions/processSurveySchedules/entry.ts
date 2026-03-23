import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Scheduled automation: runs every 5 minutes to check for surveys to launch
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get all scheduled surveys that should be active
    const now = new Date();
    const schedules = await base44.asServiceRole.entities.SurveySchedule.filter({
      status: 'scheduled'
    });

    const toActivate = [];

    for (const schedule of schedules) {
      const launchTime = new Date(schedule.launch_datetime);
      
      // Check if it's time to launch (within 5 minute window)
      if (launchTime <= now && launchTime > new Date(now.getTime() - 5 * 60000)) {
        toActivate.push(schedule);
      }
    }

    const results = [];

    for (const schedule of toActivate) {
      try {
        // Activate the survey
        await base44.asServiceRole.entities.PPCSurvey.update(schedule.survey_id, {
          status: 'active'
        });

        // Update schedule status and next launch time
        let newStatus = 'completed';
        let nextLaunchTime = null;

        if (schedule.schedule_type === 'recurring' && schedule.recurrence_pattern) {
          newStatus = 'active';
          nextLaunchTime = calculateNextLaunchTime(schedule);
        }

        await base44.asServiceRole.entities.SurveySchedule.update(schedule.id, {
          status: newStatus,
          total_launches: (schedule.total_launches || 0) + 1,
          next_launch_time: nextLaunchTime
        });

        results.push({
          survey_id: schedule.survey_id,
          activated: true,
          next_launch: nextLaunchTime
        });
      } catch (error) {
        console.error(`Failed to activate survey ${schedule.survey_id}:`, error);
        results.push({
          survey_id: schedule.survey_id,
          activated: false,
          error: error.message
        });
      }
    }

    return Response.json({
      processed: schedules.length,
      activated: results.filter(r => r.activated).length,
      results
    });
  } catch (error) {
    console.error('Survey schedule processing error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function calculateNextLaunchTime(schedule) {
  const pattern = schedule.recurrence_pattern;
  const current = new Date(schedule.launch_datetime);
  let next = new Date(current);

  if (pattern.frequency === 'daily') {
    next.setDate(next.getDate() + (pattern.interval || 1));
  } else if (pattern.frequency === 'weekly') {
    next.setDate(next.getDate() + (7 * (pattern.interval || 1)));
  } else if (pattern.frequency === 'monthly') {
    next.setMonth(next.getMonth() + (pattern.interval || 1));
  }

  // Stop if past end date
  if (pattern.end_date && next > new Date(pattern.end_date)) {
    return null;
  }

  return next.toISOString();
}