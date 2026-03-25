import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get('path') || '';

  // ── GET /widget.js  ── serve the embeddable JS loader
  if (req.method === 'GET' && path === 'widget') {
    const surveyId = url.searchParams.get('survey_id') || '';
    const widgetScript = `
(function() {
  var surveyId = "${surveyId}";
  if (!surveyId) { console.error("GamerGain: survey_id is required"); return; }

  // Inject styles
  var style = document.createElement('style');
  style.textContent = [
    '.gg-survey-widget { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }',
    '.gg-survey-header { background: linear-gradient(135deg, #dc2626, #991b1b); color: #fff; padding: 18px 24px; display: flex; align-items: center; gap: 10px; }',
    '.gg-survey-header img { width: 28px; height: 28px; }',
    '.gg-survey-header h3 { margin: 0; font-size: 16px; font-weight: 700; }',
    '.gg-survey-header p { margin: 2px 0 0; font-size: 12px; opacity: 0.85; }',
    '.gg-survey-body { background: #fff; padding: 24px; }',
    '.gg-question { margin-bottom: 20px; }',
    '.gg-question p { font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 10px; }',
    '.gg-option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1.5px solid #e5e7eb; border-radius: 8px; cursor: pointer; margin-bottom: 8px; transition: all 0.15s; }',
    '.gg-option:hover { border-color: #dc2626; background: #fef2f2; }',
    '.gg-option.selected { border-color: #dc2626; background: #fef2f2; }',
    '.gg-option input[type=radio] { accent-color: #dc2626; }',
    '.gg-progress { height: 4px; background: #f3f4f6; margin-bottom: 20px; border-radius: 2px; overflow: hidden; }',
    '.gg-progress-bar { height: 100%; background: linear-gradient(to right, #dc2626, #f97316); transition: width 0.3s; }',
    '.gg-btn { background: linear-gradient(135deg, #dc2626, #b91c1c); color: #fff; border: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }',
    '.gg-btn:hover { opacity: 0.9; }',
    '.gg-btn:disabled { opacity: 0.5; cursor: not-allowed; }',
    '.gg-footer { text-align: center; margin-top: 16px; font-size: 11px; color: #9ca3af; }',
    '.gg-footer a { color: #dc2626; text-decoration: none; }',
    '.gg-success { text-align: center; padding: 32px 24px; }',
    '.gg-success h3 { font-size: 20px; color: #16a34a; margin: 12px 0 6px; }',
    '.gg-success p { color: #6b7280; font-size: 14px; }',
  ].join('');
  document.head.appendChild(style);

  // Find container
  var container = document.querySelector('[data-gg-survey="' + surveyId + '"]');
  if (!container) { console.error("GamerGain: No container found for survey " + surveyId); return; }

  var survey = null;
  var currentQ = 0;
  var answers = [];
  var startTime = Date.now();
  var visitorId = localStorage.getItem('gg_visitor') || Math.random().toString(36).slice(2);
  localStorage.setItem('gg_visitor', visitorId);

  var API_BASE = "https://base44.com";

  function fetchSurvey() {
    container.innerHTML = '<div style="padding:24px;text-align:center;color:#6b7280;">Loading survey...</div>';
    fetch(window.__GG_API__ + '?path=get_survey&survey_id=' + surveyId)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.error) { container.innerHTML = '<div style="padding:24px;text-align:center;color:#dc2626;">' + data.error + '</div>'; return; }
        survey = data.survey;
        render();
      })
      .catch(function() {
        container.innerHTML = '<div style="padding:24px;text-align:center;color:#dc2626;">Failed to load survey.</div>';
      });
  }

  function render() {
    if (!survey || !survey.questions || survey.questions.length === 0) {
      container.innerHTML = '<div style="padding:24px;text-align:center;color:#6b7280;">No questions available.</div>';
      return;
    }
    var total = survey.questions.length;
    var q = survey.questions[currentQ];
    var opts = [
      { key: 'a', label: q.option_a }, { key: 'b', label: q.option_b },
      { key: 'c', label: q.option_c }, { key: 'd', label: q.option_d }
    ].filter(function(o) { return o.label; });

    var optionsHtml = opts.map(function(o) {
      return '<label class="gg-option" data-key="' + o.key + '"><input type="radio" name="gg_q" value="' + o.key + '"> ' + o.label + '</label>';
    }).join('');

    container.innerHTML = [
      '<div class="gg-survey-widget">',
        '<div class="gg-survey-header">',
          '<div>',
            '<h3>' + (survey.title || 'Quick Survey') + '</h3>',
            '<p>Powered by GamerGain · Earn rewards for answering</p>',
          '</div>',
        '</div>',
        '<div class="gg-survey-body">',
          '<div class="gg-progress"><div class="gg-progress-bar" style="width:' + Math.round(((currentQ) / total) * 100) + '%"></div></div>',
          '<div class="gg-question">',
            '<p>Q' + (currentQ + 1) + ' of ' + total + ': ' + q.question + '</p>',
            optionsHtml,
          '</div>',
          '<button class="gg-btn" id="gg-next-btn" disabled>' + (currentQ === total - 1 ? 'Submit Survey' : 'Next →') + '</button>',
        '</div>',
        '<div class="gg-footer">Powered by <a href="https://gamergain.com" target="_blank">GamerGain</a></div>',
      '</div>'
    ].join('');

    container.querySelectorAll('.gg-option').forEach(function(opt) {
      opt.addEventListener('click', function() {
        container.querySelectorAll('.gg-option').forEach(function(o) { o.classList.remove('selected'); });
        opt.classList.add('selected');
        opt.querySelector('input').checked = true;
        document.getElementById('gg-next-btn').disabled = false;
      });
    });

    document.getElementById('gg-next-btn').addEventListener('click', function() {
      var selected = container.querySelector('input[name=gg_q]:checked');
      if (!selected) return;
      answers.push({ question_index: currentQ, selected_option: selected.value });
      if (currentQ < total - 1) {
        currentQ++;
        render();
      } else {
        submitResponse();
      }
    });
  }

  function submitResponse() {
    var timeTaken = Math.round((Date.now() - startTime) / 1000);
    container.innerHTML = '<div class="gg-survey-widget"><div style="padding:24px;text-align:center;color:#6b7280;">Submitting...</div></div>';
    fetch(window.__GG_API__ + '?path=submit_response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ survey_id: surveyId, answers: answers, time_taken_seconds: timeTaken, visitor_id: visitorId, source: 'embed' })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      container.innerHTML = [
        '<div class="gg-survey-widget">',
          '<div class="gg-success">',
            '<div style="font-size:40px;">🎉</div>',
            '<h3>Thank you!</h3>',
            '<p>' + (data.message || 'Your response has been recorded.') + '</p>',
          '</div>',
          '<div class="gg-footer">Powered by <a href="https://gamergain.com" target="_blank">GamerGain</a></div>',
        '</div>'
      ].join('');
    })
    .catch(function() {
      container.innerHTML = '<div style="padding:24px;text-align:center;color:#dc2626;">Submission failed. Please try again.</div>';
    });
  }

  window.__GG_API__ = "https://base44app.com/api/functions/surveyWidget";
  fetchSurvey();
})();
`;
    return new Response(widgetScript, {
      headers: { ...corsHeaders, 'Content-Type': 'application/javascript' }
    });
  }

  const base44 = createClientFromRequest(req);

  // ── GET ?path=get_survey  ── fetch survey data (public, no auth)
  if (req.method === 'GET' && path === 'get_survey') {
    const surveyId = url.searchParams.get('survey_id');
    if (!surveyId) return Response.json({ error: 'survey_id required' }, { headers: corsHeaders, status: 400 });

    try {
      const surveys = await base44.asServiceRole.entities.PPCSurvey.filter({ id: surveyId });
      const survey = surveys[0];
      if (!survey) return Response.json({ error: 'Survey not found' }, { headers: corsHeaders, status: 404 });
      if (survey.status !== 'active') return Response.json({ error: 'Survey is not active' }, { headers: corsHeaders, status: 400 });

      return Response.json({ survey: {
        id: survey.id,
        title: survey.title,
        questions: survey.questions || [],
      }}, { headers: corsHeaders });
    } catch (e) {
      return Response.json({ error: e.message }, { headers: corsHeaders, status: 500 });
    }
  }

  // ── POST ?path=submit_response  ── record a response from external embed
  if (req.method === 'POST' && path === 'submit_response') {
    try {
      const body = await req.json();
      const { survey_id, answers, time_taken_seconds, visitor_id, source } = body;

      if (!survey_id || !answers) return Response.json({ error: 'Missing fields' }, { headers: corsHeaders, status: 400 });

      const surveys = await base44.asServiceRole.entities.PPCSurvey.filter({ id: survey_id });
      const survey = surveys[0];
      if (!survey) return Response.json({ error: 'Survey not found' }, { headers: corsHeaders, status: 404 });
      if (survey.status !== 'active') return Response.json({ error: 'Survey not active' }, { headers: corsHeaders, status: 400 });

      // Use visitor_id as user identifier for anonymous embed responses
      const anonUserId = 'embed_' + (visitor_id || 'unknown');

      await base44.asServiceRole.entities.PPCSurveyResponse.create({
        survey_id,
        user_id: anonUserId,
        answers,
        completed: true,
        time_taken_seconds: time_taken_seconds || 0,
        language: 'en',
        fraud_action: 'allow',
        payout_to_user: 0,
        payout_to_creator: 0,
      });

      // Increment response count on survey
      await base44.asServiceRole.entities.PPCSurvey.update(survey_id, {
        responses_count: (survey.responses_count || 0) + 1
      });

      return Response.json({ message: 'Your response has been recorded. Thank you!' }, { headers: corsHeaders });
    } catch (e) {
      return Response.json({ error: e.message }, { headers: corsHeaders, status: 500 });
    }
  }

  return Response.json({ error: 'Not found' }, { headers: corsHeaders, status: 404 });
});