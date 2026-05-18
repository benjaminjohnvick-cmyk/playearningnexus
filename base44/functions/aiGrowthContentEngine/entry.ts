import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let survey_id, winning_product_id;
    try {
      const body = await req.json();
      survey_id = body.survey_id;
      winning_product_id = body.winning_product_id;
    } catch (_) {
      // No body — scheduled/headless invocation, will batch below
    }

    // Scheduled/headless mode: process the most recent completed survey
    if (!survey_id) {
      const recentSurveys = await base44.asServiceRole.entities.PPCSurvey.filter({ status: 'completed' }, '-updated_date', 1);
      if (!recentSurveys || recentSurveys.length === 0) {
        return Response.json({ success: true, message: 'No completed surveys to process' });
      }
      survey_id = recentSurveys[0].id;
    }

    // Get survey results & winning product
    const survey = await base44.asServiceRole.entities.PPCSurvey.get(survey_id);
    const responses = await base44.asServiceRole.entities.PPCSurveyResponse.filter({
      survey_id,
      status: 'completed'
    });

    const product = winning_product_id 
      ? await base44.asServiceRole.entities.Product.get(winning_product_id)
      : null;

    // Extract key insights from survey
    const insights = {
      total_responses: responses.length,
      satisfaction_rate: responses.filter(r => r.rating >= 4).length / responses.length * 100,
      main_themes: await extractThemes(responses, base44),
      demographic_split: extractDemographics(responses),
      product_name: product?.name || 'Our Latest Winner',
      category: survey.category || 'Product'
    };

    // Generate content for each platform
    const content = await Promise.all([
      generateYouTubeContent(insights, base44),
      generateTwitterContent(insights, base44),
      generateInstagramContent(insights, base44)
    ]);

    // Schedule posts for optimal times
    const schedules = scheduleContentPosting(content);

    // Store content records
    const contentIds = [];
    for (const item of content) {
      const record = await base44.asServiceRole.entities.GeneratedImage.create({
        content_type: item.platform,
        content_data: item,
        survey_id,
        status: 'scheduled',
        scheduled_for: item.scheduled_time
      });
      contentIds.push(record.id);
    }

    return Response.json({
      success: true,
      survey_id,
      content_generated: content.length,
      platforms: ['youtube', 'twitter', 'instagram'],
      insights,
      scheduled_posts: schedules,
      content_ids: contentIds
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function extractThemes(responses, base44) {
  const comments = responses.map(r => r.comment).filter(Boolean);
  if (comments.length === 0) return [];

  const analysis = await base44.integrations.Core.InvokeLLM({
    prompt: `Extract 3-5 key themes from these survey responses:\n${comments.join('\n')}`,
    response_json_schema: {
      type: 'object',
      properties: {
        themes: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 5
        }
      }
    }
  });

  return analysis.data.themes;
}

function extractDemographics(responses) {
  const byAge = {};
  responses.forEach(r => {
    const age = r.age_group || 'unknown';
    byAge[age] = (byAge[age] || 0) + 1;
  });
  return byAge;
}

async function generateYouTubeContent(insights, base44) {
  const script = await base44.integrations.Core.InvokeLLM({
    prompt: `Create a YouTube video script (2-3 minutes) about "${insights.product_name}" based on survey insights. Include: ${insights.main_themes.join(', ')}. Make it engaging and include a CTA.`,
    response_json_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        script: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
        thumbnail_prompt: { type: 'string' }
      }
    }
  });

  return {
    platform: 'youtube',
    type: 'video_script',
    ...script.data,
    survey_insights: insights,
    scheduled_time: getYouTubePeakTime()
  };
}

async function generateTwitterContent(insights, base44) {
  const threads = await base44.integrations.Core.InvokeLLM({
    prompt: `Create a Twitter thread (5-8 tweets) about "${insights.product_name}". Include survey stats: ${insights.satisfaction_rate.toFixed(0)}% satisfaction. Make it viral and engaging.`,
    response_json_schema: {
      type: 'object',
      properties: {
        tweets: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 8
        },
        hashtags: { type: 'array', items: { type: 'string' } }
      }
    }
  });

  return {
    platform: 'twitter',
    type: 'thread',
    ...threads.data,
    survey_insights: insights,
    scheduled_time: getTwitterPeakTime()
  };
}

async function generateInstagramContent(insights, base44) {
  const captions = await base44.integrations.Core.InvokeLLM({
    prompt: `Create 3 Instagram carousel post captions about "${insights.product_name}" with survey insights. Each caption should be 150-200 chars with emojis and hashtags.`,
    response_json_schema: {
      type: 'object',
      properties: {
        captions: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 3
        },
        hashtags: { type: 'array', items: { type: 'string' } },
        image_prompts: { type: 'array', items: { type: 'string' }, maxItems: 3 }
      }
    }
  });

  return {
    platform: 'instagram',
    type: 'carousel',
    ...captions.data,
    survey_insights: insights,
    scheduled_time: getInstagramPeakTime()
  };
}

function getYouTubePeakTime() {
  // YouTube peak: Wed/Thu 8pm EST
  const now = new Date();
  let nextPeak = new Date(now);
  
  // Find next Wed/Thu
  while (nextPeak.getDay() !== 3 && nextPeak.getDay() !== 4) {
    nextPeak.setDate(nextPeak.getDate() + 1);
  }
  
  nextPeak.setHours(20, 0, 0, 0); // 8 PM
  return nextPeak.toISOString();
}

function getTwitterPeakTime() {
  // Twitter peak: Tue/Wed/Thu 9am & 5pm EST
  const now = new Date();
  let nextPeak = new Date(now);
  
  while (nextPeak.getDay() < 2 || nextPeak.getDay() > 4) {
    nextPeak.setDate(nextPeak.getDate() + 1);
  }
  
  nextPeak.setHours(9, 0, 0, 0);
  return nextPeak.toISOString();
}

function getInstagramPeakTime() {
  // Instagram peak: Mon-Fri 11am & 6pm EST
  const now = new Date();
  let nextPeak = new Date(now);
  
  while (nextPeak.getDay() === 0 || nextPeak.getDay() === 6) {
    nextPeak.setDate(nextPeak.getDate() + 1);
  }
  
  nextPeak.setHours(11, 0, 0, 0);
  return nextPeak.toISOString();
}

function scheduleContentPosting(content) {
  return content.map(c => ({
    platform: c.platform,
    scheduled_time: c.scheduled_time,
    content_type: c.type
  }));
}