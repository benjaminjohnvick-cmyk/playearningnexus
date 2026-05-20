import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sequence_id, prospect_reply_text } = await req.json();

    if (!sequence_id || !prospect_reply_text) {
      return Response.json({ 
        error: 'sequence_id and prospect_reply_text are required' 
      }, { status: 400 });
    }

    // Fetch the sequence
    const sequences = await base44.entities.EmailSequence.filter({ 
      id: sequence_id 
    });
    
    if (!sequences || sequences.length === 0) {
      return Response.json({ error: 'Sequence not found' }, { status: 404 });
    }

    const sequence = sequences[0];

    // Use Core.InvokeLLM to analyze sentiment with response_json_schema
    const sentimentAnalysis = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze the sentiment of this prospect response and determine if it indicates positive engagement or interest in continuing the conversation.

Prospect reply: "${prospect_reply_text}"

Respond in JSON format with:
1. sentiment: "positive", "neutral", or "negative"
2. confidence: 0-100 (how confident you are in this assessment)
3. reasoning: brief explanation
4. should_pause_sequence: true if positive response detected, false otherwise`,
      response_json_schema: {
        type: 'object',
        properties: {
          sentiment: {
            type: 'string',
            enum: ['positive', 'neutral', 'negative']
          },
          confidence: {
            type: 'number'
          },
          reasoning: {
            type: 'string'
          },
          should_pause_sequence: {
            type: 'boolean'
          }
        },
        required: ['sentiment', 'confidence', 'reasoning', 'should_pause_sequence']
      }
    });

    // Determine if sequence should be paused
    const shouldPause = sentimentAnalysis.should_pause_sequence && sentimentAnalysis.confidence >= 60;

    const updateData = {
      prospect_last_reply: prospect_reply_text,
      prospect_reply_date: new Date().toISOString(),
      response_sentiment: sentimentAnalysis.sentiment
    };

    if (shouldPause) {
      updateData.status = 'paused';
      updateData.pause_reason = `positive_response_detected_confidence_${sentimentAnalysis.confidence}`;
    }

    // Update the sequence
    await base44.entities.EmailSequence.update(sequence_id, updateData);

    // Send notification email to owner if sequence paused
    if (shouldPause) {
      const prospect = await base44.entities.CRMProspect.filter({ 
        id: sequence.prospect_id 
      });
      
      const prospectData = prospect && prospect.length > 0 ? prospect[0] : null;

      if (prospectData) {
        const ownerUser = await base44.entities.User.filter({ 
          id: sequence.owner_id 
        });
        
        const ownerEmail = ownerUser && ownerUser.length > 0 ? ownerUser[0].email : null;

        if (ownerEmail) {
          await base44.integrations.Core.SendEmail({
            to: ownerEmail,
            subject: `🎯 Positive Response Detected - ${prospectData.company_name}`,
            body: `A positive response has been detected from ${prospectData.contact_name} at ${prospectData.company_name}.\n\nTheir reply:\n"${prospect_reply_text}"\n\nAI Sentiment: ${sentimentAnalysis.sentiment} (Confidence: ${sentimentAnalysis.confidence}%)\n\nThe email sequence has been automatically paused. Review the prospect and take manual action.`,
            from_name: 'CRM Automation'
          });
        }
      }
    }

    return Response.json({
      sequence_id: sequence_id,
      sentiment: sentimentAnalysis.sentiment,
      confidence: sentimentAnalysis.confidence,
      reasoning: sentimentAnalysis.reasoning,
      sequence_paused: shouldPause,
      pause_reason: shouldPause ? updateData.pause_reason : null
    });
  } catch (error) {
    console.error('Response analysis error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});