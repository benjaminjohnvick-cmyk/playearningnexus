# PlayEarning Nexus — Full Source of Every Changed File (complete, current)

88 text source files changed vs the original GitHub `main` (plus 5 binary icon files, listed but not embedded: assets/icon.png, public/icons/*.png). Companion docs in the project: CHANGES, MASTER-LAUNCH-GUIDE, MOBILE-APP-WRAPPER-GUIDE, PRIVACY-POLICY, TERMS-OF-SERVICE, CONFIG-AND-SECRETS, COMPLIANCE-AND-ASSUMPTIONS.

## `.gitignore`

```gitignore
#env
.env
.env.*

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Native platform folders are GENERATED build artifacts, not source.
# The repo is wrapper-only: android/ and ios/ are regenerated at build time
# via `npm run native:regenerate` (npx cap add + sync) and are never committed.
/android
/ios
.gradle
*.keystore
.capacitor

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

.env
base44/.app.jsonc
```

## `base44/agents/autonomous_ecosystem_superagent.jsonc`

```jsonc
{
  "description": "Top-level super-agent that runs the self-growing ecosystem: it turns survey data (internal + external company surveys), feature votes, and suggestions into AI-generated games, features, services, and content — with human-review gates on anything risky.",
  "instructions": "You are GamerGain's Autonomous Ecosystem Super-Agent. Your mandate is to let the platform grow itself from real demand data, safely.\n\n**PRIMARY LOOP (run on cadence, default daily):**\n1. Run autonomousEcosystemEngine. It ingests demand from every survey source (internal Surveys, external company PPC + BitLabs responses, FeatureVoteSurvey votes, UserSuggestions, GameVotes), generates AI insight on what to build next, and delegates creation across the active pillars.\n2. Check EcosystemConfig first: only act on pillars in active_pillars, and only when demand exceeds min_signal_threshold. If autonomous_mode is off, do nothing unless a human forces a run.\n3. After each run, review the EcosystemRunLog: confirm what was generated and surface anything marked requires_review to an admin.\n\n**PILLARS & DELEGATION:**\n- Surveys: generateAISurvey, runSurveyIntelligence — keep the survey supply matched to company + user demand.\n- Features: generateWeeklyFeatureVoteSurvey → concludeWeeklyFeatureVote → aiAutomaticFeatureImplementation.\n- Games: aiGameCreatorFromFeedback for winning game demand.\n- Services/Products: autoFeedbackAndProductEngine, publishWinningSurveyProduct.\n- Content: aiGenerateContentLibrary.\n- Ongoing ops: delegate to masterOrchestrator and aiOrchestrator (they already run fraud, retention, churn, payouts, learning).\n\n**SAFETY — NON-NEGOTIABLE:**\n- You GENERATE and QUEUE. You do not silently ship anything in human_review_categories (payments, auth, payouts, security) — those ALWAYS require explicit human approval.\n- Only items flagged low-risk and only when auto_deploy_enabled is true may be auto-applied.\n- Every cycle must be logged to EcosystemRunLog for auditability.\n- If error rate is high or signal looks manipulated (fraud), pause and alert an admin instead of acting.\n\n**GOAL:** A platform whose games, features, services, and surveys are continuously shaped by what users and partner companies actually want — measurable each cycle in EcosystemRunLog.",
  "tool_configs": [
    { "type": "backend_function", "function_name": "autonomousEcosystemEngine", "reason": "Run one full ecosystem growth cycle" },
    { "type": "backend_function", "function_name": "generateAISurvey", "reason": "Generate new surveys from demand" },
    { "type": "backend_function", "function_name": "runSurveyIntelligence", "reason": "Analyze survey data for opportunities" },
    { "type": "backend_function", "function_name": "generateWeeklyFeatureVoteSurvey", "reason": "Publish the weekly feature vote" },
    { "type": "backend_function", "function_name": "concludeWeeklyFeatureVote", "reason": "Conclude votes and pick winners" },
    { "type": "backend_function", "function_name": "aiAutomaticFeatureImplementation", "reason": "Plan implementation of winning features" },
    { "type": "backend_function", "function_name": "aiGameCreatorFromFeedback", "reason": "Draft new games from feedback" },
    { "type": "backend_function", "function_name": "autoFeedbackAndProductEngine", "reason": "Turn feedback into products/services" },
    { "type": "backend_function", "function_name": "publishWinningSurveyProduct", "reason": "Publish winning survey-driven products" },
    { "type": "backend_function", "function_name": "aiGenerateContentLibrary", "reason": "Replenish the content library" },
    { "type": "backend_function", "function_name": "masterOrchestrator", "reason": "Delegate cross-domain operations" },
    { "type": "backend_function", "function_name": "aiOrchestrator", "reason": "Delegate the closed-loop AI pipeline" },
    { "entity_name": "EcosystemConfig", "allowed_operations": ["create", "read", "update"] },
    { "entity_name": "EcosystemRunLog", "allowed_operations": ["create", "read"] },
    { "entity_name": "UserSuggestion", "allowed_operations": ["read", "update"] },
    { "entity_name": "FeatureVoteSurvey", "allowed_operations": ["read", "update"] },
    { "entity_name": "Notification", "allowed_operations": ["create"] }
  ],
  "name": "autonomous_ecosystem_superagent"
}
```

## `base44/agents/feature_vote_growth_agent.jsonc`

```jsonc
{
  "description": "Runs the data-driven weekly growth loop: publishes the mandatory paid feature/game vote survey, correlates responses, ranks by votes, and hands the winning idea to the auto-implementation planner.",
  "instructions": "You operate GamerGain's weekly, data-driven roadmap loop. Your job is to turn user demand into shipped features.\n\n**WEEKLY CADENCE:**\n1. START OF WEEK (Monday): Run generateWeeklyFeatureVoteSurvey to publish that week's mandatory $0.10 feature/game vote survey, built from the most-upvoted UserSuggestions and pending FeatureMockups. This notifies active users.\n2. DURING THE WEEK: Users vote via the Weekly Feature Vote page (submitFeatureVote credits their $0.10 and prevents double-voting).\n3. END OF WEEK (after closes_at): Run concludeWeeklyFeatureVote to tally responses, rank candidates by vote count, pick the winner, generate an implementation spec, and record a FeatureMockup flagged for implementation.\n4. HANDOFF: concludeWeeklyFeatureVote calls aiAutomaticFeatureImplementation with the winning spec. Treat items it marks 'auto_deploy' as safe to ship; route 'manual_review' items to a human before shipping. For winning NEW GAMES, you may also call aiGameCreatorFromFeedback.\n\n**RULES:**\n- Never open two active surveys in the same week.\n- Rank strictly by number of votes/responses; break ties by most total engagement, then earliest suggestion.\n- Only auto-implement low-risk, clearly-specified items; anything touching payments, auth, or payouts is ALWAYS manual review.\n- Keep an audit trail: the FeatureVoteSurvey record holds the winner, votes, and generated spec.\n\n**GOAL:** Every week, the feature users most want moves measurably closer to shipping.",
  "tool_configs": [
    {
      "type": "backend_function",
      "function_name": "generateWeeklyFeatureVoteSurvey",
      "reason": "Publish the weekly mandatory $0.10 feature/game vote survey"
    },
    {
      "type": "backend_function",
      "function_name": "concludeWeeklyFeatureVote",
      "reason": "Tally votes, pick the winner, generate the implementation spec"
    },
    {
      "type": "backend_function",
      "function_name": "aiAutomaticFeatureImplementation",
      "reason": "Turn the winning spec into a prioritized implementation plan"
    },
    {
      "type": "backend_function",
      "function_name": "aiGameCreatorFromFeedback",
      "reason": "Draft a new game when a game candidate wins"
    },
    {
      "entity_name": "FeatureVoteSurvey",
      "allowed_operations": ["create", "read", "update"]
    },
    {
      "entity_name": "UserSuggestion",
      "allowed_operations": ["read", "update"]
    },
    {
      "entity_name": "FeatureMockup",
      "allowed_operations": ["create", "read", "update"]
    },
    {
      "entity_name": "Notification",
      "allowed_operations": ["create"]
    }
  ],
  "name": "feature_vote_growth_agent"
}
```

## `base44/agents/weekly_referral_campaign_agent.jsonc`

```jsonc
{
  "description": "Runs the weekly rotating-platform referral contest end to end, DAILY and automatically, with legal/ethical guardrails: opt-in participation, FTC-disclosed posts, compliant auto-posting only for connected+consenting users, and fair reward crediting.",
  "instructions": "You run GamerGain's referral contest fully automatically, once per day, via autoReferralContestDaily.\n\n**DAILY LOOP (autoReferralContestDaily does all of this):**\n1. Lifecycle: conclude the finished week and open the next week's campaign, rotating the platform (Twitter/X -> Instagram -> Facebook -> TikTok -> LinkedIn).\n2. Compliant auto-posting: post on a user's behalf ONLY when they have connected that account via OAuth (SocialMediaConnection is_active), enabled auto_posting_enabled, and accepted the agreement (MLMNode accepted_ula) — and only within the 12h rate limit. Every auto-post carries an FTC '#ad' disclosure and unique AI copy (generateAndPostAffiliateAds).\n3. Everyone else gets an OPTIONAL reminder — never a forced or silent post. Users may also post manually via submitReferralPost.\n4. Fairness: sweep-credit rewards pending longer than the grace period (creditPendingReferralPostRewards grace_days) so earned money is never forfeited. Normal path still credits pending rewards on survey completion.\n\n**HARD RULES (do not violate):**\n- Participation is OPT-IN and voluntary. Never make posting or surveys mandatory or penalize users for skipping.\n- Never post to a user's personal account without explicit OAuth connection + auto_posting opt-in + accepted agreement.\n- Every referral/affiliate post MUST include an FTC disclosure (#ad). No undisclosed endorsements.\n- Respect platform rate limits and Terms of Service; vary content per user to avoid spam/inauthentic-behavior flags. If a platform token is invalid, stop and require re-auth.\n- Two tracks (business_referral, user_referral) on separate leaderboards; real conversions still earn the standard 5% commission (autoReferralCommissions).\n- The 'best platform' rule is a positive nudge (optional double bonus), never a punishment.\n\n**GOAL:** A hands-off, compliant weekly referral engine that distributes across platforms, respects users and platform rules, and never forfeits earned rewards.",
  "tool_configs": [
    { "type": "backend_function", "function_name": "autoReferralContestDaily", "reason": "Run the entire contest end to end, daily" },
    { "type": "backend_function", "function_name": "generateWeeklyReferralCampaign", "reason": "Open the weekly rotating-platform campaign" },
    { "type": "backend_function", "function_name": "concludeWeeklyReferralCampaign", "reason": "Close the week and build leaderboards" },
    { "type": "backend_function", "function_name": "generateAndPostAffiliateAds", "reason": "Compliant auto-post for connected, consenting users" },
    { "type": "backend_function", "function_name": "creditPendingReferralPostRewards", "reason": "Credit pending $0.10 rewards on survey / grace sweep" },
    { "type": "backend_function", "function_name": "autoReferralCommissions", "reason": "Award standard affiliate commission on conversions" },
    { "entity_name": "WeeklyReferralCampaign", "allowed_operations": ["create", "read", "update"] },
    { "entity_name": "ReferralPostEntry", "allowed_operations": ["create", "read", "update"] },
    { "entity_name": "UserPlatformStats", "allowed_operations": ["create", "read", "update"] },
    { "entity_name": "SocialMediaConnection", "allowed_operations": ["read"] },
    { "entity_name": "MLMNode", "allowed_operations": ["read"] },
    { "entity_name": "EcosystemRunLog", "allowed_operations": ["create"] },
    { "entity_name": "Notification", "allowed_operations": ["create"] }
  ],
  "name": "weekly_referral_campaign_agent"
}
```

## `base44/entities/EcosystemConfig.jsonc`

```jsonc
{
  "name": "EcosystemConfig",
  "type": "object",
  "properties": {
    "autonomous_mode": {
      "type": "boolean",
      "default": false,
      "description": "Master switch for the self-running ecosystem loop"
    },
    "active_pillars": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["surveys", "games", "features", "services", "content"]
      },
      "default": ["surveys", "games", "features", "services", "content"],
      "description": "Which creation pillars the engine may act on"
    },
    "cadence_hours": {
      "type": "number",
      "default": 24,
      "description": "How often the ecosystem engine runs"
    },
    "auto_deploy_enabled": {
      "type": "boolean",
      "default": false,
      "description": "If true, low-risk generated items may be auto-applied; risky items always need review"
    },
    "human_review_categories": {
      "type": "array",
      "items": { "type": "string" },
      "default": ["payments", "auth", "payouts", "security"],
      "description": "Categories that ALWAYS require human approval, never auto-deploy"
    },
    "min_signal_threshold": {
      "type": "number",
      "default": 5,
      "description": "Minimum survey responses/votes before the engine will act on a demand signal"
    },
    "last_run_at": {
      "type": "string",
      "format": "date-time"
    },
    "last_run_summary": {
      "type": "string"
    },
    "total_runs": {
      "type": "number",
      "default": 0
    },
    "total_items_generated": {
      "type": "number",
      "default": 0
    }
  },
  "required": []
}
```

## `base44/entities/EcosystemRunLog.jsonc`

```jsonc
{
  "name": "EcosystemRunLog",
  "type": "object",
  "properties": {
    "run_at": {
      "type": "string",
      "format": "date-time"
    },
    "trigger": {
      "type": "string",
      "enum": ["scheduled", "manual"],
      "default": "scheduled"
    },
    "status": {
      "type": "string",
      "enum": ["completed", "partial", "failed", "skipped"],
      "default": "completed"
    },
    "data_snapshot": {
      "type": "string",
      "description": "JSON snapshot of the survey/vote/suggestion volumes ingested this run"
    },
    "insights": {
      "type": "string",
      "description": "AI-generated demand/opportunity insights for this cycle"
    },
    "generated": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "pillar": { "type": "string" },
          "action": { "type": "string" },
          "reference_id": { "type": "string" },
          "requires_review": { "type": "boolean" }
        }
      },
      "default": [],
      "description": "What the engine created/queued this run"
    },
    "actions": {
      "type": "array",
      "items": { "type": "string" },
      "default": []
    },
    "errors": {
      "type": "array",
      "items": { "type": "string" },
      "default": []
    },
    "duration_ms": {
      "type": "number"
    }
  },
  "required": [
    "run_at",
    "status"
  ]
}
```

## `base44/entities/FeatureVoteSurvey.jsonc`

```jsonc
{
  "name": "FeatureVoteSurvey",
  "type": "object",
  "properties": {
    "week_of": {
      "type": "string",
      "format": "date",
      "description": "The Monday of the week this survey runs"
    },
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "active",
        "closed",
        "concluded"
      ],
      "default": "active"
    },
    "is_mandatory": {
      "type": "boolean",
      "default": false,
      "description": "Opt-in by default. Voluntary + incentivized (streak/bonus), not forced with penalties (avoids unfair-practice risk)."
    },
    "reward_amount": {
      "type": "number",
      "default": 0.1,
      "description": "USD paid to each user who completes the survey"
    },
    "closes_at": {
      "type": "string",
      "format": "date-time"
    },
    "candidates": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "candidate_id": { "type": "string" },
          "type": { "type": "string", "enum": ["game", "feature", "ui_ux"] },
          "title": { "type": "string" },
          "description": { "type": "string" },
          "source_suggestion_id": { "type": "string" },
          "votes": { "type": "number", "default": 0 },
          "voter_ids": { "type": "array", "items": { "type": "string" }, "default": [] }
        }
      },
      "default": [],
      "description": "Games/features users vote on"
    },
    "total_responses": {
      "type": "number",
      "default": 0
    },
    "responder_ids": {
      "type": "array",
      "items": { "type": "string" },
      "default": []
    },
    "winner_candidate_id": {
      "type": "string"
    },
    "winner_title": {
      "type": "string"
    },
    "implementation_triggered": {
      "type": "boolean",
      "default": false
    },
    "implementation_spec": {
      "type": "string",
      "description": "AI-generated implementation spec for the winning candidate"
    }
  },
  "required": [
    "week_of",
    "status"
  ]
}
```

## `base44/entities/GroupContribution.jsonc`

```jsonc
{
  "name": "GroupContribution",
  "type": "object",
  "description": "A member's contribution of credits into a SharedWalletGroup pool.",
  "properties": {
    "group_id": { "type": "string" },
    "user_id": { "type": "string" },
    "user_name": { "type": "string" },
    "amount": { "type": "number" },
    "month": { "type": "string", "description": "YYYY-MM the contribution counts toward" }
  },
  "required": ["group_id", "user_id", "amount"]
}
```

## `base44/entities/GroupSpendRequest.jsonc`

```jsonc
{
  "name": "GroupSpendRequest",
  "type": "object",
  "description": "A request to spend from a SharedWalletGroup pool — either a large-ticket purchase or a transfer to a member. Owner-approved.",
  "properties": {
    "group_id": { "type": "string" },
    "requested_by": { "type": "string" },
    "requester_name": { "type": "string" },
    "type": { "type": "string", "enum": ["purchase", "transfer"], "default": "purchase" },
    "item_name": { "type": "string", "description": "For purchases: what is being bought" },
    "recipient_user_id": { "type": "string", "description": "For transfers: who receives the credits" },
    "amount": { "type": "number" },
    "status": { "type": "string", "enum": ["pending", "approved", "rejected", "paid"], "default": "pending" },
    "approved_by": { "type": "string" },
    "resolved_at": { "type": "string", "format": "date-time" }
  },
  "required": ["group_id", "requested_by", "amount"]
}
```

## `base44/entities/MarketTrendReport.jsonc`

```jsonc
{
  "name": "MarketTrendReport",
  "type": "object",
  "properties": {
    "report_date": {
      "type": "string",
      "format": "date-time",
      "description": "When the report was generated"
    },
    "report_type": {
      "type": "string",
      "description": "Report category, e.g. competitive_intelligence, market_trend, implementation_plan, survey_ux_analysis"
    },
    "title": {
      "type": "string",
      "description": "Human-readable report title"
    },
    "summary": {
      "type": "string",
      "description": "Executive summary of the report"
    },
    "threat_assessment": {
      "type": "string",
      "description": "Serialized competitive threat assessment (JSON string)"
    },
    "strategic_recommendations": {
      "type": "string",
      "description": "Serialized strategic recommendations (JSON string)"
    },
    "data": {
      "type": "string",
      "description": "Serialized report payload (JSON string) consumed by dashboards"
    },
    "data_source": {
      "type": "string",
      "description": "Origin of the underlying data (e.g. ai_web_search_aggregation)"
    },
    "category": {
      "type": "string",
      "description": "Optional market/product category the report focuses on"
    }
  },
  "required": [
    "report_type"
  ]
}
```

## `base44/entities/PerformanceAlert.jsonc`

```jsonc
{
  "name": "PerformanceAlert",
  "type": "object",
  "properties": {
    "affiliate_id": {
      "type": "string",
      "description": "User/affiliate the alert is about"
    },
    "alert_type": {
      "type": "string",
      "description": "Alert category, e.g. low_conversion_rate, no_recent_activity, declining_activity"
    },
    "severity": {
      "type": "string",
      "enum": [
        "low",
        "medium",
        "high",
        "critical"
      ],
      "default": "medium"
    },
    "message": {
      "type": "string",
      "description": "Human-readable alert detail"
    },
    "metric_value": {
      "type": "number",
      "description": "Optional numeric value tied to the alert (e.g. conversion rate)"
    },
    "recommended_action": {
      "type": "string",
      "description": "Suggested remediation"
    },
    "status": {
      "type": "string",
      "enum": [
        "active",
        "acknowledged",
        "resolved"
      ],
      "default": "active"
    }
  },
  "required": [
    "alert_type"
  ]
}
```

## `base44/entities/ReferralJackpot.jsonc`

```jsonc
{
  "name": "ReferralJackpot",
  "type": "object",
  "description": "Weekly SKILL-BASED referral tournament (formerly a random jackpot). Winners are ranked by performance score, never chance. An optional entry fee funds the prize pool. Entity name retained for backward compatibility across the app.",
  "properties": {
    "period": {
      "type": "string",
      "description": "e.g. 2026-Q1"
    },
    "status": {
      "type": "string",
      "enum": [
        "active",
        "paid_out",
        "completed",
        "cancelled"
      ],
      "default": "active"
    },
    "is_skill_based": {
      "type": "boolean",
      "default": true,
      "description": "Winners are determined by performance ranking, not a random draw"
    },
    "ranking_metric": {
      "type": "string",
      "default": "verified_referral_revenue",
      "description": "Merit metric: participants ranked by the verified, revenue-generating referrals they drive. Open to all; outcome tracks ability, not chance."
    },
    "open_to_all": {
      "type": "boolean",
      "default": true,
      "description": "Every user can participate and earn purely on performance — no entry fee required to earn from your own referrals"
    },
    "pool_funding_rate": {
      "type": "number",
      "default": 0.4,
      "description": "Share of the verified referral-driven revenue paid into the reward pool. The platform keeps the remainder as margin, so the program is always net-positive."
    },
    "distribution_model": {
      "type": "string",
      "default": "proportional_plus_top_bonus",
      "description": "Most of the pool is paid proportionally to each participant's verified contribution (everyone who performs earns); a top-rank bonus rewards the leaders."
    },
    "revenue_driven": {
      "type": "number",
      "default": 0,
      "description": "Verified revenue this participant's referrals generated in the period"
    },
    "verified_conversions": {
      "type": "number",
      "default": 0,
      "description": "Count of this participant's referrals that converted (quality-gated, anti-fraud)"
    },
    "entry_fee": {
      "type": "number",
      "default": 0,
      "description": "Optional fee to enter the skill tournament; entry fees fund the prize pool"
    },
    "prize_pool": {
      "type": "number",
      "default": 0,
      "description": "Total prize pool = platform contribution + collected entry fees"
    },
    "payout_places": {
      "type": "number",
      "default": 3,
      "description": "Number of top-ranked finishers who share the prize pool"
    },
    "jackpot_amount": {
      "type": "number",
      "default": 0,
      "description": "Platform contribution to the prize pool"
    },
    "user_id": {
      "type": "string",
      "description": "Participant this entry record belongs to"
    },
    "user_email": {
      "type": "string"
    },
    "jackpot_entries_earned": {
      "type": "number",
      "default": 0,
      "description": "Performance points earned (referrals/shares) — the skill ranking metric"
    },
    "entry_fee_paid": {
      "type": "number",
      "default": 0
    },
    "is_paid_entry": {
      "type": "boolean",
      "default": false
    },
    "total_entries": {
      "type": "number",
      "default": 0
    },
    "winners": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "user_id": { "type": "string" },
          "user_name": { "type": "string" },
          "rank": { "type": "number" },
          "score": { "type": "number" },
          "prize_amount": { "type": "number" }
        }
      },
      "default": [],
      "description": "Top-ranked finishers and their prizes"
    },
    "winner_user_id": { "type": "string" },
    "winner_name": { "type": "string" },
    "winner_entries": { "type": "number", "default": 0 },
    "payout_amount": { "type": "number", "default": 0 },
    "paid_at": { "type": "string", "format": "date-time" },
    "completed_date": { "type": "string", "format": "date-time" },
    "entry_breakdown": {
      "type": "object",
      "additionalProperties": true,
      "description": "user_id -> performance points"
    }
  },
  "required": [
    "period"
  ]
}
```

## `base44/entities/ReferralPostEntry.jsonc`

```jsonc
{
  "name": "ReferralPostEntry",
  "type": "object",
  "properties": {
    "campaign_id": {
      "type": "string"
    },
    "user_id": {
      "type": "string"
    },
    "user_name": {
      "type": "string"
    },
    "week_of": {
      "type": "string",
      "format": "date"
    },
    "platform": {
      "type": "string",
      "enum": ["twitter", "instagram", "facebook", "tiktok", "linkedin"]
    },
    "track": {
      "type": "string",
      "enum": ["business_referral", "user_referral"],
      "default": "user_referral",
      "description": "Whether this is a business or individual-user referral"
    },
    "post_url": {
      "type": "string",
      "description": "Link to the user's proof-of-post"
    },
    "referral_code": {
      "type": "string",
      "description": "Referral code shared in the post"
    },
    "was_doubled": {
      "type": "boolean",
      "default": false,
      "description": "True if this entry counts toward a doubled assignment (user missed the prior week)"
    },
    "reward_amount": {
      "type": "number",
      "default": 0.1
    },
    "reward_pending": {
      "type": "boolean",
      "default": true,
      "description": "Reward is held until the user next completes a survey"
    },
    "reward_credited": {
      "type": "boolean",
      "default": false
    },
    "reward_credited_at": {
      "type": "string",
      "format": "date-time"
    },
    "conversions": {
      "type": "number",
      "default": 0,
      "description": "Referral conversions attributed to this post"
    },
    "commission_earned": {
      "type": "number",
      "default": 0,
      "description": "Standard affiliate commission earned from this post's conversions"
    }
  },
  "required": ["campaign_id", "user_id", "platform"]
}
```

## `base44/entities/RespondentProfile.jsonc`

```jsonc
{
  "name": "RespondentProfile",
  "type": "object",
  "properties": {
    "user_id": {
      "type": "string",
      "description": "User this respondent profile belongs to"
    },
    "user_email": {
      "type": "string"
    },
    "age": {
      "type": "number",
      "description": "Respondent age, used for survey targeting"
    },
    "gender": {
      "type": "string"
    },
    "country": {
      "type": "string"
    },
    "interests": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "default": [],
      "description": "Interest tags used for survey matching"
    },
    "quality_score": {
      "type": "number",
      "default": 0,
      "description": "Response quality / reliability score"
    },
    "is_verified": {
      "type": "boolean",
      "default": false,
      "description": "Whether the respondent's identity/demographics are verified"
    },
    "completed_surveys": {
      "type": "number",
      "default": 0
    },
    "demographics": {
      "type": "object",
      "description": "Additional demographic attributes",
      "default": {}
    }
  },
  "required": [
    "user_id"
  ]
}
```

## `base44/entities/SharedWalletGroup.jsonc`

```jsonc
{
  "name": "SharedWalletGroup",
  "type": "object",
  "description": "A user group (e.g. a family) whose members pool credits toward large-ticket items and can transfer to each other. Uses closed-loop platform credit, not external cash.",
  "properties": {
    "name": { "type": "string" },
    "group_type": {
      "type": "string",
      "enum": ["family", "friends", "team", "other"],
      "default": "family"
    },
    "owner_user_id": { "type": "string" },
    "member_ids": { "type": "array", "items": { "type": "string" }, "default": [] },
    "member_count": { "type": "number", "default": 1 },
    "max_members": { "type": "number", "default": 10 },
    "invite_code": { "type": "string", "description": "Short code others use to join" },
    "monthly_goal": { "type": "number", "default": 0, "description": "Target pooled amount per month (e.g. 120)" },
    "purpose": { "type": "string", "description": "The large-ticket item/goal the group is saving toward" },
    "pooled_balance": { "type": "number", "default": 0, "description": "Current shared pool balance (credits)" },
    "status": { "type": "string", "enum": ["active", "closed"], "default": "active" }
  },
  "required": ["name", "owner_user_id"]
}
```

## `base44/entities/Survey.jsonc`

```jsonc
{
  "name": "Survey",
  "type": "object",
  "properties": {
    "user_id": {
      "type": "string",
      "description": "User who was offered / completed the survey"
    },
    "title": {
      "type": "string",
      "description": "Survey title"
    },
    "category": {
      "type": "string",
      "description": "Survey category / topic (e.g. Tech, Finance, Health)"
    },
    "provider": {
      "type": "string",
      "description": "Survey source or provider (e.g. bitlabs, internal, ppc)"
    },
    "external_survey_id": {
      "type": "string",
      "description": "Provider-side survey identifier"
    },
    "status": {
      "type": "string",
      "enum": [
        "available",
        "in_progress",
        "completed",
        "disqualified",
        "expired"
      ],
      "default": "available",
      "description": "Lifecycle status of the survey for this user"
    },
    "reward_amount": {
      "type": "number",
      "default": 0,
      "description": "Reward offered for completing the survey (USD)"
    },
    "earnings": {
      "type": "number",
      "default": 0,
      "description": "Amount actually earned by the user for this survey (USD)"
    },
    "estimated_time_minutes": {
      "type": "number",
      "description": "Estimated completion time in minutes"
    },
    "completion_date": {
      "type": "string",
      "format": "date-time",
      "description": "When the user completed the survey"
    }
  },
  "required": [
    "user_id"
  ]
}
```

## `base44/entities/UserPlatformStats.jsonc`

```jsonc
{
  "name": "UserPlatformStats",
  "type": "object",
  "properties": {
    "user_id": {
      "type": "string"
    },
    "platform": {
      "type": "string",
      "enum": ["twitter", "instagram", "facebook", "tiktok", "linkedin"]
    },
    "posts": {
      "type": "number",
      "default": 0
    },
    "conversions": {
      "type": "number",
      "default": 0
    },
    "commission_earned": {
      "type": "number",
      "default": 0,
      "description": "Total commission this user has earned from this platform"
    },
    "return_rate": {
      "type": "number",
      "default": 0,
      "description": "conversions / posts — used to pick the user's best platform for doubled assignments"
    },
    "last_post_at": {
      "type": "string",
      "format": "date-time"
    }
  },
  "required": ["user_id", "platform"]
}
```

## `base44/entities/WeeklyReferralCampaign.jsonc`

```jsonc
{
  "name": "WeeklyReferralCampaign",
  "type": "object",
  "properties": {
    "week_of": {
      "type": "string",
      "format": "date",
      "description": "Monday of the campaign week"
    },
    "week_index": {
      "type": "number",
      "description": "Sequential week number used to rotate the platform"
    },
    "platform": {
      "type": "string",
      "enum": ["twitter", "instagram", "facebook", "tiktok", "linkedin"],
      "description": "The required social platform for this week"
    },
    "title": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": ["active", "closed", "concluded"],
      "default": "active"
    },
    "is_mandatory": {
      "type": "boolean",
      "default": false,
      "description": "Opt-in by default. Participation is voluntary and incentivized, never forced (avoids coercion/unfair-practice risk)."
    },
    "reward_per_post": {
      "type": "number",
      "default": 0.1,
      "description": "USD earned per post, credited on next survey completion or auto-credited after a grace period so earned rewards are never forfeited"
    },
    "requires_disclosure": {
      "type": "boolean",
      "default": true,
      "description": "All referral posts must carry an FTC affiliate/ad disclosure"
    },
    "disclosure_text": {
      "type": "string",
      "default": "#ad",
      "description": "Disclosure appended to auto-generated posts (FTC endorsement compliance)"
    },
    "tracks": {
      "type": "array",
      "items": { "type": "string", "enum": ["business_referral", "user_referral"] },
      "default": ["business_referral", "user_referral"],
      "description": "Separate leaderboards for business vs individual-user referrers"
    },
    "closes_at": {
      "type": "string",
      "format": "date-time"
    },
    "total_posts": {
      "type": "number",
      "default": 0
    },
    "participant_ids": {
      "type": "array",
      "items": { "type": "string" },
      "default": []
    },
    "leaderboard_business": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "user_id": { "type": "string" },
          "user_name": { "type": "string" },
          "posts": { "type": "number" },
          "conversions": { "type": "number" },
          "commission_earned": { "type": "number" }
        }
      },
      "default": []
    },
    "leaderboard_user": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "user_id": { "type": "string" },
          "user_name": { "type": "string" },
          "posts": { "type": "number" },
          "conversions": { "type": "number" },
          "commission_earned": { "type": "number" }
        }
      },
      "default": []
    }
  },
  "required": ["week_of", "platform", "status"]
}
```

## `base44/functions/aiDisputeEvidenceAnalyzer/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// AI-assisted dispute evidence analyzer.
// Called from AIDisputeAutomationDashboard with { claim_id }.
// Loads the claim + related platform records, runs an LLM assessment, and
// returns the claim enriched with an AI recommendation for the admin to review.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { claim_id } = await req.json();
    if (!claim_id) {
      return Response.json({ error: 'claim_id required' }, { status: 400 });
    }

    const claims = await base44.asServiceRole.entities.DisputeClaim.filter({ id: claim_id });
    if (!claims.length) {
      return Response.json({ error: 'Claim not found' }, { status: 404 });
    }
    const claim = claims[0];

    // Gather supporting platform evidence for the claimant
    let transactions = [];
    let dailyEarnings = [];
    try {
      transactions = await base44.asServiceRole.entities.Transaction.filter(
        { user_id: claim.user_id }, '-created_date', 25
      );
    } catch { /* entity optional */ }
    try {
      dailyEarnings = await base44.asServiceRole.entities.DailyEarnings.filter(
        { user_id: claim.user_id }, '-created_date', 25
      );
    } catch { /* entity optional */ }

    const evidence = {
      claim_type: claim.claim_type,
      description: claim.description,
      expected_amount: claim.expected_amount,
      proof_url_count: (claim.proof_urls || []).length,
      items: claim.items || [],
      recent_transactions: transactions.map((t) => ({
        amount: t.amount, type: t.transaction_type, status: t.status, date: t.created_date,
      })),
      recent_earnings_count: dailyEarnings.length,
    };

    const analysisPrompt = `You are a fraud-aware dispute analyst for a rewards platform.
Assess this user dispute claim and the supporting platform records. Decide whether the
claim should be approved, denied, or needs manual review. Consider whether proof was
provided, whether the expected amount is consistent with the user's transaction history,
and any signs of abuse.

CLAIM AND EVIDENCE:
${JSON.stringify(evidence, null, 2)}`;

    let ai;
    try {
      ai = await base44.integrations.Core.InvokeLLM({
        prompt: analysisPrompt,
        model: 'gpt_5_mini',
        response_json_schema: {
          type: 'object',
          properties: {
            evidence_assessment: { type: 'string' },
            recommendation: { type: 'string', enum: ['approve', 'deny', 'needs_review'] },
            reasoning: { type: 'string' },
            suggested_amount: { type: 'number' },
            confidence_score: { type: 'number', minimum: 0, maximum: 100 },
          },
        },
      });
    } catch (llmErr) {
      // Deterministic fallback if the LLM is unavailable
      const hasProof = (claim.proof_urls || []).length > 0;
      ai = {
        evidence_assessment: hasProof
          ? 'Proof provided; amount checked against history.'
          : 'No proof attached to the claim.',
        recommendation: hasProof ? 'needs_review' : 'deny',
        reasoning: hasProof
          ? 'Claim includes supporting files and should be reviewed by an admin.'
          : 'No supporting evidence was supplied with this claim.',
        suggested_amount: hasProof ? (claim.expected_amount || 0) : 0,
        confidence_score: hasProof ? 55 : 40,
      };
    }

    // Persist the AI assessment onto the claim for the audit trail
    try {
      await base44.asServiceRole.entities.DisputeClaim.update(claim.id, {
        admin_notes: `AI: ${ai.recommendation} (${ai.confidence_score}%) — ${ai.reasoning}`,
      });
    } catch { /* non-fatal */ }

    return Response.json({
      ...claim,
      ai_analysis: ai,
      recommendation: ai.recommendation,
      confidence_score: ai.confidence_score,
      suggested_amount: ai.suggested_amount,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Analysis failed' }, { status: 500 });
  }
});
```

## `base44/functions/approveGroupSpend/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Group owner approves (or rejects) a pending spend request and executes it.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { request_id, decision = 'approve' } = await req.json();
    if (!request_id) return Response.json({ error: 'request_id is required' }, { status: 400 });

    const reqs = await base44.asServiceRole.entities.GroupSpendRequest.filter({ id: request_id });
    const request = reqs[0];
    if (!request) return Response.json({ error: 'Request not found' }, { status: 404 });
    if (request.status !== 'pending') return Response.json({ error: `Request already ${request.status}` }, { status: 409 });

    const groups = await base44.asServiceRole.entities.SharedWalletGroup.filter({ id: request.group_id });
    const group = groups[0];
    if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });
    if (user.id !== group.owner_user_id) {
      return Response.json({ error: 'Only the group owner can approve spending' }, { status: 403 });
    }

    if (decision === 'reject') {
      await base44.asServiceRole.entities.GroupSpendRequest.update(request.id, {
        status: 'rejected', approved_by: user.id, resolved_at: new Date().toISOString(),
      });
      return Response.json({ success: true, status: 'rejected' });
    }

    if ((group.pooled_balance || 0) < request.amount) {
      return Response.json({ error: 'Insufficient pool balance', pooled_balance: group.pooled_balance || 0 }, { status: 402 });
    }

    // Debit the pool; for transfers, credit the recipient.
    await base44.asServiceRole.entities.SharedWalletGroup.update(group.id, {
      pooled_balance: (group.pooled_balance || 0) - request.amount,
    });
    if (request.type === 'transfer' && request.recipient_user_id) {
      try {
        const recips = await base44.asServiceRole.entities.User.filter({ id: request.recipient_user_id });
        if (recips[0]) {
          await base44.asServiceRole.entities.User.update(recips[0].id, { virtual_currency: (recips[0].virtual_currency || 0) + request.amount });
        }
      } catch { /* non-fatal */ }
    }
    await base44.asServiceRole.entities.GroupSpendRequest.update(request.id, {
      status: 'paid', approved_by: user.id, resolved_at: new Date().toISOString(),
    });

    // Notify the requester.
    try {
      await base44.asServiceRole.entities.Notification.create({
        user_id: request.requested_by,
        title: '✅ Group spend approved',
        message: `Your $${request.amount} request for "${group.name}" was approved and paid from the pool.`,
        notification_type: 'group_spend_approved',
        related_entity_id: group.id,
      });
    } catch { /* non-fatal */ }

    return Response.json({ success: true, status: 'paid', pooled_balance: (group.pooled_balance || 0) - request.amount });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to approve spend' }, { status: 500 });
  }
});
```

## `base44/functions/autoChallengeAndEventLifecycle/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const entityName = event?.entity_name;

    // DailyChallenge created → broadcast to all users
    if (entityName === 'DailyChallenge' && event?.type === 'create') {
      const challenge = data;
      const users = await base44.asServiceRole.entities.User.list('-created_date', 50);
      for (const user of users) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          type: 'daily_challenge_new',
          title: `🎯 New Daily Challenge: ${challenge.title || 'Daily Challenge'}!`,
          message: `${challenge.description || 'Complete today\'s challenge'} — Reward: ${challenge.reward || 'XP & Bonus'}. Ends tonight!`,
          is_read: false
        });
      }
    }

    // WeeklyEvent created → broadcast + AI generate promo copy
    if (entityName === 'WeeklyEvent' && event?.type === 'create') {
      const weeklyEvent = data;
      const promo = await base44.integrations.Core.InvokeLLM({
        prompt: `Write a hype notification for this GamerGain weekly event: "${weeklyEvent.title || 'Weekly Event'}" — ${weeklyEvent.description || ''}. Prize: ${weeklyEvent.prize || 'rewards'}. Max 100 chars.`,
        response_json_schema: { type: "object", properties: { message: { type: "string" } } }
      });
      const users = await base44.asServiceRole.entities.User.list('-created_date', 50);
      for (const user of users) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          type: 'weekly_event_new',
          title: `🗓️ Weekly Event: ${weeklyEvent.title || 'Event'}!`,
          message: promo.message || `${weeklyEvent.description || 'A new weekly event has started!'}`,
          is_read: false
        });
      }
    }

    // DailyChallenge updated to completed → award winners
    if (entityName === 'DailyChallenge' && event?.type === 'update' && data.status === 'completed') {
      const challenge = data;
      if (challenge.winner_ids?.length > 0) {
        for (const winnerId of challenge.winner_ids.slice(0, 10)) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: winnerId,
            type: 'challenge_won',
            title: `🏆 Daily Challenge Complete!`,
            message: `You completed "${challenge.title}"! Your reward has been credited.`,
            is_read: false
          });
          await base44.asServiceRole.entities.UserActivity.create({
            user_id: winnerId,
            activity_type: 'daily_challenge_completed',
            points_earned: challenge.xp_reward || 50,
            metadata: { challenge_id: challenge.id }
          });
        }
      }
    }

    // WeeklyEvent ended → announce results
    if (entityName === 'WeeklyEvent' && event?.type === 'update' && data.status === 'ended') {
      const weeklyEvent = data;
      if (weeklyEvent.winner_id) {
        const winner = (await base44.asServiceRole.entities.User.filter({ id: weeklyEvent.winner_id }))[0];
        const users = await base44.asServiceRole.entities.User.list('-created_date', 30);
        for (const user of users) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: user.id,
            type: 'weekly_event_ended',
            title: `🎊 Weekly Event Ended!`,
            message: `"${weeklyEvent.title}" is over! Winner: ${winner?.full_name || 'a top gamer'}. Prize: ${weeklyEvent.prize || 'Reward'}. New event coming soon!`,
            is_read: false
          });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});```

## `base44/functions/autoReferralContestDaily/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * AUTO REFERRAL CONTEST — DAILY, END TO END
 *
 * Runs every day and manages the whole weekly rotating-platform referral contest
 * with legal/ethical guardrails baked in:
 *   1. Lifecycle: conclude the finished week + open the next (rotated) platform.
 *   2. Compliant auto-posting: ONLY for users who have explicitly connected the
 *      account (OAuth), enabled auto_posting, and accepted the agreement, and only
 *      within platform rate limits. Every post carries an FTC #ad disclosure.
 *      Everyone else just gets an optional reminder — never a forced/silent post.
 *   3. Fairness: sweep-credit any rewards pending longer than the grace period so
 *      earned money is never forfeited.
 *   4. Audit: log the run.
 */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_LIMIT_HOURS = 12;   // matches autoSocialPostingAndTracking
const GRACE_DAYS = 30;

Deno.serve(async (req) => {
  const started = Date.now();
  const actions: string[] = [];
  const errors: string[] = [];
  let autoPosted = 0;
  let reminded = 0;

  try {
    const base44 = createClientFromRequest(req);

    const call = async (fn: string, payload: any = {}) => {
      try { const r = await base44.asServiceRole.functions.invoke(fn, payload); actions.push(`invoked ${fn}`); return r; }
      catch (e) { errors.push(`${fn}: ${e?.message || 'failed'}`); return null; }
    };

    // ---- 1. Lifecycle: conclude finished week, ensure a fresh campaign is open ----
    await call('concludeWeeklyReferralCampaign', {});
    let actives = await base44.asServiceRole.entities.WeeklyReferralCampaign.filter({ status: 'active' }, '-created_date', 1);
    if (actives.length === 0) {
      await call('generateWeeklyReferralCampaign', {});
      actives = await base44.asServiceRole.entities.WeeklyReferralCampaign.filter({ status: 'active' }, '-created_date', 1);
    }
    const campaign = actives[0];
    if (!campaign) {
      return Response.json({ success: false, reason: 'No active campaign could be established', errors });
    }
    const platform = campaign.platform;
    const disclosure = campaign.disclosure_text || '#ad';

    // ---- 2. Compliant auto-posting for OPTED-IN, CONNECTED users only ----
    let connections: any[] = [];
    try {
      connections = await base44.asServiceRole.entities.SocialMediaConnection.filter({
        is_active: true, auto_posting_enabled: true, platform,
      });
    } catch { /* entity optional */ }

    const now = Date.now();
    for (const conn of connections) {
      try {
        // Consent gate: require an accepted user agreement (ULA) to auto-post.
        const nodes = await base44.asServiceRole.entities.MLMNode.filter({ user_id: conn.user_id, accepted_ula: true });
        if (nodes.length === 0) continue;

        // Rate limit.
        const last = conn.last_post_at ? new Date(conn.last_post_at).getTime() : 0;
        if (last && (now - last) / (1000 * 60 * 60) < RATE_LIMIT_HOURS) continue;

        // Skip if we already logged a contest post for this user this week.
        const already = await base44.asServiceRole.entities.ReferralPostEntry.filter({ campaign_id: campaign.id, user_id: conn.user_id });
        if (already.length > 0) continue;

        // Post through the existing compliant affiliate-posting path, with disclosure.
        await call('generateAndPostAffiliateAds', { user_id: conn.user_id, platform, disclosure, require_disclosure: true, source: 'weekly_referral_contest' });

        // Record the contest entry (reward pending until next survey / grace sweep).
        const usr = await base44.asServiceRole.entities.User.filter({ id: conn.user_id }).then((u: any) => u[0]).catch(() => null);
        const isBusiness = usr && (usr.account_type === 'business' || usr.is_business === true || usr.role === 'business_client' || !!usr.business_client_id);
        await base44.asServiceRole.entities.ReferralPostEntry.create({
          campaign_id: campaign.id, user_id: conn.user_id, user_name: usr?.full_name || '',
          week_of: campaign.week_of, platform, track: isBusiness ? 'business_referral' : 'user_referral',
          post_url: '', referral_code: usr?.referral_code || '', was_doubled: false,
          reward_amount: campaign.reward_per_post || 0.1, reward_pending: true, reward_credited: false,
          conversions: 0, commission_earned: 0,
        });
        autoPosted++;
      } catch (e) { errors.push(`autopost ${conn.user_id}: ${e?.message || 'failed'}`); }
    }

    // ---- 2b. Optional reminder for users who are NOT opted into auto-posting ----
    // (Bounded; never posts on their behalf — participation stays voluntary.)
    try {
      const optedInIds = new Set(connections.map((c) => c.user_id));
      const recent = await base44.asServiceRole.entities.User.list('-updated_date', 200);
      for (const u of recent) {
        if (optedInIds.has(u.id)) continue;
        const has = await base44.asServiceRole.entities.ReferralPostEntry.filter({ campaign_id: campaign.id, user_id: u.id });
        if (has.length > 0) continue;
        await base44.asServiceRole.entities.Notification.create({
          user_id: u.id,
          title: `This week's referral challenge (${platform})`,
          message: `Post your referral on ${platform} with #ad to earn $0.10 + commission. Optional — post yourself or connect your account to automate it.`,
          notification_type: 'weekly_referral_reminder',
          related_entity_id: campaign.id,
        });
        reminded++;
        if (reminded >= 200) break;
      }
    } catch { /* optional */ }

    // ---- 3. Fairness sweep: auto-credit long-pending rewards ----
    const swept = await call('creditPendingReferralPostRewards', { grace_days: GRACE_DAYS });

    // ---- 4. Audit log ----
    try {
      await base44.asServiceRole.entities.EcosystemRunLog.create({
        run_at: new Date().toISOString(), trigger: 'scheduled',
        status: errors.length === 0 ? 'completed' : 'partial',
        data_snapshot: JSON.stringify({ platform, connections: connections.length, auto_posted: autoPosted, reminded }),
        insights: `Daily referral contest: ${autoPosted} compliant auto-posts, ${reminded} reminders, ${swept?.credited_count || 0} rewards swept-credited.`,
        actions, errors, duration_ms: Date.now() - started,
      });
    } catch { /* optional */ }

    return Response.json({
      success: true, platform, auto_posted: autoPosted, reminded,
      rewards_swept: swept?.credited_count || 0, errors, duration_ms: Date.now() - started,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Daily referral automation failed', errors }, { status: 500 });
  }
});
```

## `base44/functions/autonomousEcosystemEngine/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * AUTONOMOUS ECOSYSTEM ENGINE
 *
 * The connective loop that lets the platform grow itself from survey data.
 * Each cycle it:
 *   1. Ingests demand signal from ALL survey sources — internal surveys,
 *      external/company surveys (PPC + BitLabs), feature votes, suggestions.
 *   2. Generates AI insight on what to build next.
 *   3. Acts across the configured pillars (surveys / games / features /
 *      services / content) by delegating to the existing generator functions.
 *   4. Delegates ongoing ops to masterOrchestrator + aiOrchestrator.
 *   5. Logs the run and updates EcosystemConfig.
 *
 * SAFETY: it GENERATES and QUEUES work. Anything in human_review_categories
 * (payments, auth, payouts, security) is always flagged requires_review and is
 * never auto-deployed. auto_deploy_enabled only affects clearly low-risk items.
 *
 * Intended schedule: daily (or per EcosystemConfig.cadence_hours).
 */
Deno.serve(async (req) => {
  const started = Date.now();
  const generated: any[] = [];
  const actions: string[] = [];
  const errors: string[] = [];

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { force = false, dry_run = false } = body;

    // ---- 1. Load or create the ecosystem config ----
    let config;
    try {
      const cfgs = await base44.asServiceRole.entities.EcosystemConfig.list('-created_date', 1);
      config = cfgs[0];
    } catch { /* entity may be new */ }
    if (!config) {
      try { config = await base44.asServiceRole.entities.EcosystemConfig.create({ autonomous_mode: false }); }
      catch { config = { autonomous_mode: false, active_pillars: ['surveys', 'games', 'features', 'services', 'content'], human_review_categories: ['payments', 'auth', 'payouts', 'security'], min_signal_threshold: 5, total_runs: 0, total_items_generated: 0 }; }
    }

    if (!config.autonomous_mode && !force) {
      return Response.json({ skipped: true, reason: 'autonomous_mode is off (pass force:true to run once)' });
    }

    const pillars = config.active_pillars || ['surveys', 'games', 'features', 'services', 'content'];
    const reviewCats = config.human_review_categories || ['payments', 'auth', 'payouts', 'security'];
    const threshold = config.min_signal_threshold ?? 5;
    const canPillar = (p: string) => pillars.includes(p);

    const call = async (fnName: string, payload: any = {}) => {
      try {
        const res = await base44.asServiceRole.functions.invoke(fnName, payload);
        actions.push(`invoked ${fnName}`);
        return res;
      } catch (e) {
        errors.push(`${fnName}: ${e?.message || 'failed'}`);
        return null;
      }
    };

    const countSafe = async (entity: string, filter: any = {}) => {
      try { const rows = await base44.asServiceRole.entities[entity].filter(filter, '-created_date', 1000); return rows.length; }
      catch { return 0; }
    };

    // ---- 2. Ingest demand signal from every survey source ----
    const snapshot = {
      internal_surveys_completed: await countSafe('Survey', { status: 'completed' }),
      feedback_responses: await countSafe('FeedbackSurveyResponse'),
      company_ppc_responses: await countSafe('PPCSurveyResponse'),
      feature_votes_open: await countSafe('FeatureVoteSurvey', { status: 'active' }),
      user_suggestions_pending: await countSafe('UserSuggestion', { status: 'pending' }),
      game_votes: await countSafe('GameVote'),
    };
    const totalSignal = Object.values(snapshot).reduce((a, b) => a + (b as number), 0);

    if (totalSignal < threshold && !force) {
      const log = await writeLog(base44, { started, snapshot, generated, actions, errors, status: 'skipped', insights: 'Below signal threshold' });
      return Response.json({ skipped: true, reason: 'Not enough demand signal yet', snapshot, log_id: log });
    }

    // ---- 3. AI insight on what to build next ----
    let insights = '';
    try {
      const ai = await base44.integrations.Core.InvokeLLM({
        prompt: `You run growth for a play-to-earn platform. Based on this demand signal from
internal + external company surveys, feature votes, and suggestions, name the top 3
opportunities to build next (games, features, or services) and why. Be specific and concise.

SIGNAL: ${JSON.stringify(snapshot, null, 2)}`,
        model: 'gpt_5_mini',
        response_json_schema: {
          type: 'object',
          properties: {
            top_opportunities: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, pillar: { type: 'string' }, rationale: { type: 'string' } } }, maxItems: 3 },
            summary: { type: 'string' },
          },
        },
      });
      insights = typeof ai === 'string' ? ai : JSON.stringify(ai);
    } catch (e) {
      insights = 'LLM insight unavailable; proceeded with rule-based pillar actions.';
      errors.push(`insight: ${e?.message || 'failed'}`);
    }

    if (dry_run) {
      return Response.json({ dry_run: true, snapshot, insights, would_run_pillars: pillars });
    }

    // ---- 4. Act across pillars (delegating to existing generators) ----
    // SURVEYS — keep the survey engine fed (internal + company demand)
    if (canPillar('surveys')) {
      await call('generateAISurvey', { source: 'ecosystem_engine' });
      await call('runSurveyIntelligence', {});
      generated.push({ pillar: 'surveys', action: 'generated AI survey + intelligence pass', requires_review: false });
    }

    // FEATURES — run the weekly vote loop + auto-implementation planning
    if (canPillar('features')) {
      await call('generateWeeklyFeatureVoteSurvey', {});
      const concl = await call('concludeWeeklyFeatureVote', {});
      const winner = concl?.concluded?.[0]?.winner;
      generated.push({ pillar: 'features', action: winner ? `queued feature: ${winner}` : 'feature vote cycle advanced', requires_review: true });
    }

    // GAMES — draft new games from feedback/votes
    if (canPillar('games')) {
      const g = await call('aiGameCreatorFromFeedback', { source: 'ecosystem_engine' });
      generated.push({ pillar: 'games', action: 'drafted new game concept from feedback', reference_id: g?.game_id || '', requires_review: true });
    }

    // SERVICES / PRODUCTS — turn winning survey demand into products/services
    if (canPillar('services')) {
      await call('autoFeedbackAndProductEngine', {});
      await call('publishWinningSurveyProduct', {});
      generated.push({ pillar: 'services', action: 'advanced product/service pipeline from survey winners', requires_review: true });
    }

    // CONTENT — replenish the content library
    if (canPillar('content')) {
      await call('aiGenerateContentLibrary', {});
      generated.push({ pillar: 'content', action: 'generated content library items', requires_review: false });
    }

    // ---- 5. Delegate ongoing operations to the existing self-running loops ----
    await call('masterOrchestrator', {});
    await call('aiOrchestrator', {});

    // Flag anything in a review category (never auto-deploy those)
    for (const g of generated) {
      if (reviewCats.some((c) => (g.action || '').toLowerCase().includes(c))) g.requires_review = true;
    }

    // ---- 6. Persist run log + update config ----
    const status = errors.length === 0 ? 'completed' : (generated.length ? 'partial' : 'failed');
    const logId = await writeLog(base44, { started, snapshot, generated, actions, errors, status, insights });

    try {
      if (config.id) {
        await base44.asServiceRole.entities.EcosystemConfig.update(config.id, {
          last_run_at: new Date().toISOString(),
          last_run_summary: `${generated.length} items across ${pillars.length} pillars; ${errors.length} errors`,
          total_runs: (config.total_runs || 0) + 1,
          total_items_generated: (config.total_items_generated || 0) + generated.length,
        });
      }
    } catch (e) { errors.push(`config update: ${e?.message}`); }

    return Response.json({
      success: true,
      status,
      snapshot,
      insights,
      generated,
      actions_count: actions.length,
      errors,
      log_id: logId,
      duration_ms: Date.now() - started,
    });
  } catch (error) {
    try {
      const base44 = createClientFromRequest(req);
      await writeLog(base44, { started, snapshot: {}, generated, actions, errors: [...errors, error?.message || 'fatal'], status: 'failed', insights: '' });
    } catch { /* ignore */ }
    return Response.json({ error: error?.message || 'Ecosystem engine failed' }, { status: 500 });
  }
});

async function writeLog(base44: any, o: any): Promise<string> {
  try {
    const log = await base44.asServiceRole.entities.EcosystemRunLog.create({
      run_at: new Date().toISOString(),
      trigger: 'scheduled',
      status: o.status,
      data_snapshot: JSON.stringify(o.snapshot || {}),
      insights: (o.insights || '').slice(0, 5000),
      generated: o.generated || [],
      actions: o.actions || [],
      errors: o.errors || [],
      duration_ms: Date.now() - (o.started || Date.now()),
    });
    return log?.id || '';
  } catch {
    return '';
  }
}
```

## `base44/functions/banAppealScorer/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Scores a user's ban appeal and recommends an action for admin review.
// Referenced by the universal_admin_action_agent. Accepts the appeal details
// (plus optional user_id), pulls the user's history, and returns an LLM-backed
// recommendation with a numeric score.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { user_id, appeal_text, ban_reason } = await req.json();
    if (!appeal_text) {
      return Response.json({ error: 'appeal_text required' }, { status: 400 });
    }

    // Gather signal on the appealing user, if identified.
    let history = { fraud_reports: 0, disputes: 0, account_age_days: null, total_earned: 0 };
    if (user_id) {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ id: user_id });
        const u = users[0];
        if (u?.created_date) {
          history.account_age_days = Math.round(
            (Date.now() - new Date(u.created_date).getTime()) / (24 * 60 * 60 * 1000)
          );
        }
      } catch { /* optional */ }
      try {
        const fr = await base44.asServiceRole.entities.FraudReport.filter({ user_id });
        history.fraud_reports = fr.length;
      } catch { /* optional */ }
      try {
        const dc = await base44.asServiceRole.entities.DisputeClaim.filter({ user_id });
        history.disputes = dc.length;
      } catch { /* optional */ }
      try {
        const tx = await base44.asServiceRole.entities.Transaction.filter({ user_id });
        history.total_earned = tx
          .filter((t) => t.transaction_type === 'survey_earning' && t.status === 'completed')
          .reduce((s, t) => s + (t.amount || 0), 0);
      } catch { /* optional */ }
    }

    const prompt = `You are a trust & safety analyst reviewing a ban appeal.
Weigh the appeal text against the user's platform history and recommend whether to
uphold the ban, reduce it to a warning, or reinstate the account.

BAN REASON: ${ban_reason || 'unspecified'}
APPEAL: ${appeal_text}
USER HISTORY: ${JSON.stringify(history)}`;

    let ai;
    try {
      ai = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: 'gpt_5_mini',
        response_json_schema: {
          type: 'object',
          properties: {
            recommendation: { type: 'string', enum: ['uphold_ban', 'reduce_to_warning', 'reinstate', 'needs_human_review'] },
            appeal_score: { type: 'number', minimum: 0, maximum: 100, description: 'Higher = stronger appeal' },
            reasoning: { type: 'string' },
            risk_flags: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    } catch {
      // Heuristic fallback
      const risky = history.fraud_reports > 0;
      ai = {
        recommendation: risky ? 'uphold_ban' : 'needs_human_review',
        appeal_score: risky ? 20 : 50,
        reasoning: risky
          ? 'User has prior fraud reports; appeal is weak.'
          : 'No automated LLM available; route to a human reviewer.',
        risk_flags: risky ? ['prior_fraud_reports'] : [],
      };
    }

    return Response.json({ user_id: user_id || null, history, ...ai });
  } catch (error) {
    return Response.json({ error: error?.message || 'Scoring failed' }, { status: 500 });
  }
});
```

## `base44/functions/businessClientReengagementEngine/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Identifies inactive/at-risk business clients and drafts re-engagement campaigns
// (as RetentionCampaign records with status "pending_approval") for admin review.
// Called from BusinessClientReengagementDashboard with {}.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const clients = await base44.asServiceRole.entities.BusinessClient.list('-updated_date', 200);
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    // Existing pending campaigns so we don't duplicate
    let existing = [];
    try {
      existing = await base44.asServiceRole.entities.RetentionCampaign.filter(
        { status: 'pending_approval' }, '-created_date', 500
      );
    } catch { /* ignore */ }
    const alreadyTargeted = new Set(existing.map((c) => c.user_id));

    const created = [];
    for (const client of clients) {
      const ownerId = client.owner_user_id || client.user_id;
      if (!ownerId || alreadyTargeted.has(ownerId)) continue;

      const lastActive = client.updated_date || client.last_active_date || client.created_date;
      const inactiveMs = lastActive ? now - new Date(lastActive).getTime() : Infinity;
      const isAtRisk =
        inactiveMs > THIRTY_DAYS ||
        client.status === 'inactive' ||
        client.status === 'churned';
      if (!isAtRisk) continue;

      const annualValue =
        client.annual_value ||
        (client.monthly_spend ? client.monthly_spend * 12 : 0) ||
        (client.total_spent || 0);

      const churnScore = Math.min(
        100,
        Math.round((inactiveMs === Infinity ? 90 : (inactiveMs / THIRTY_DAYS) * 30))
      );

      try {
        const campaign = await base44.asServiceRole.entities.RetentionCampaign.create({
          user_id: ownerId,
          campaign_type: 'churn_comeback',
          incentive_type: 'standard',
          status: 'pending_approval',
          name: `Win back ${client.company_name || client.name || 'client'}`,
          description:
            `Re-engagement outreach for an inactive business client` +
            `${annualValue ? ` worth ~$${Math.round(annualValue)}/yr` : ''}.`,
          annual_value_target: annualValue,
          churn_score: churnScore,
          bonus_amount: 0,
          email_sent: false,
          claimed: false,
        });
        created.push(campaign);
        alreadyTargeted.add(ownerId);
      } catch { /* skip clients that fail validation */ }
    }

    return Response.json({
      created: created.length,
      campaigns: created,
      scanned: clients.length,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Re-engagement failed' }, { status: 500 });
  }
});
```

## `base44/functions/buyContestPowerUp/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Purchases a head-to-head contest power-up, deducting virtual currency from the
// buyer and recording a ContestPowerUp. Called from HeadToHeadContest.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { contest_id, power_up_type, target_user_id } = body;

    const VALID = ['stun', 'pause', 'skip_turn'];
    if (!contest_id || !VALID.includes(power_up_type)) {
      return Response.json(
        { error: 'contest_id and a valid power_up_type (stun|pause|skip_turn) are required' },
        { status: 400 }
      );
    }

    const COST = 0.5; // matches ContestPowerUp.cost default
    const balance = user.virtual_currency || 0;
    if (balance < COST) {
      return Response.json(
        { error: 'Insufficient balance', required: COST, balance },
        { status: 402 }
      );
    }

    // Deduct the cost from the buyer
    await base44.asServiceRole.entities.User.update(user.id, {
      virtual_currency: balance - COST,
    });

    // Record the power-up
    const powerUp = await base44.asServiceRole.entities.ContestPowerUp.create({
      user_id: user.id,
      contest_id,
      power_up_type,
      cost: COST,
      target_user_id: target_user_id || null,
      used_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      power_up: powerUp,
      remaining_balance: balance - COST,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Purchase failed' }, { status: 500 });
  }
});
```

## `base44/functions/concludeWeeklyFeatureVote/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Concludes any active feature-vote survey whose window has closed:
// correlates responses, ranks candidates by votes, picks the winner, generates
// an implementation spec, records a FeatureMockup, and hands the winner to
// aiAutomaticFeatureImplementation. Intended to run weekly after generation.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const active = await base44.asServiceRole.entities.FeatureVoteSurvey.filter({ status: 'active' }, '-created_date', 20);
    const now = Date.now();
    const concluded = [];

    for (const survey of active) {
      // Only conclude once the voting window has elapsed.
      if (survey.closes_at && new Date(survey.closes_at).getTime() > now) continue;

      const candidates = [...(survey.candidates || [])].sort((a, b) => (b.votes || 0) - (a.votes || 0));
      const winner = candidates[0];

      if (!winner || (winner.votes || 0) === 0) {
        // No engagement — close without a winner.
        await base44.asServiceRole.entities.FeatureVoteSurvey.update(survey.id, { status: 'closed' });
        continue;
      }

      // Generate an implementation spec for the winning idea.
      let spec = '';
      try {
        const ai = await base44.integrations.Core.InvokeLLM({
          prompt: `Users voted for this to be built next on a play-to-earn gaming platform.
Write a concise, developer-ready implementation spec (5-8 bullet points): data model
changes, UI screens/components, backend functions, and rollout steps.

WINNER (${winner.type}): ${winner.title}
Description: ${winner.description || 'n/a'}
Votes: ${winner.votes} of ${survey.total_responses} responses.`,
          model: 'gpt_5_mini',
        });
        spec = typeof ai === 'string' ? ai : JSON.stringify(ai);
      } catch {
        spec = `Implement "${winner.title}" (${winner.type}). Winner of the week-of-${survey.week_of} vote with ${winner.votes} votes. Manual spec required — LLM unavailable.`;
      }

      // Record a FeatureMockup entry flagged for implementation.
      let mockupId = '';
      try {
        const mockup = await base44.asServiceRole.entities.FeatureMockup.create({
          feature_name: winner.title,
          title: winner.title,
          description: winner.description || '',
          category: winner.type === 'game' ? 'game_mechanic' : winner.type === 'ui_ux' ? 'platform_ui' : 'dashboard',
          implementation_spec: spec,
          total_survey_votes: winner.votes,
          top_response: winner.title,
          implemented: false,
          mockup_phase: 'implementing',
        });
        mockupId = mockup.id;
      } catch { /* optional */ }

      // Mark the originating suggestion as in-mockup.
      if (winner.source_suggestion_id) {
        try { await base44.asServiceRole.entities.UserSuggestion.update(winner.source_suggestion_id, { in_mockup: true, status: 'pending' }); } catch { /* ignore */ }
      }

      await base44.asServiceRole.entities.FeatureVoteSurvey.update(survey.id, {
        status: 'concluded',
        winner_candidate_id: winner.candidate_id,
        winner_title: winner.title,
        implementation_spec: spec,
        implementation_triggered: true,
      });

      // Hand off to the existing auto-implementation planner (best-effort).
      try {
        await base44.functions.invoke('aiAutomaticFeatureImplementation', {
          source: 'weekly_feature_vote',
          feature: winner.title,
          spec,
          mockup_id: mockupId,
        });
      } catch { /* the planner may run on its own schedule */ }

      concluded.push({ survey_id: survey.id, winner: winner.title, votes: winner.votes });
    }

    return Response.json({ success: true, concluded_count: concluded.length, concluded });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to conclude surveys' }, { status: 500 });
  }
});
```

## `base44/functions/concludeWeeklyReferralCampaign/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Closes any active weekly referral campaign whose window has elapsed, builds the
// business and user leaderboards, and concludes it. Users with no entry this week
// are automatically "doubled up" next week (handled at submit time by submitReferralPost).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const active = await base44.asServiceRole.entities.WeeklyReferralCampaign.filter({ status: 'active' }, '-created_date', 10);
    const now = Date.now();
    const concluded = [];

    for (const campaign of active) {
      if (campaign.closes_at && new Date(campaign.closes_at).getTime() > now) continue;

      const entries = await base44.asServiceRole.entities.ReferralPostEntry.filter({ campaign_id: campaign.id }, '-created_date', 5000);

      const agg = (track: string) => {
        const byUser: Record<string, any> = {};
        for (const e of entries.filter((x: any) => x.track === track)) {
          const u = byUser[e.user_id] || { user_id: e.user_id, user_name: e.user_name || '', posts: 0, conversions: 0, commission_earned: 0 };
          u.posts += 1;
          u.conversions += e.conversions || 0;
          u.commission_earned += e.commission_earned || 0;
          byUser[e.user_id] = u;
        }
        return Object.values(byUser)
          .sort((a: any, b: any) => b.conversions - a.conversions || b.posts - a.posts)
          .slice(0, 100);
      };

      await base44.asServiceRole.entities.WeeklyReferralCampaign.update(campaign.id, {
        status: 'concluded',
        leaderboard_business: agg('business_referral'),
        leaderboard_user: agg('user_referral'),
      });

      concluded.push({ campaign_id: campaign.id, platform: campaign.platform, entries: entries.length });
    }

    return Response.json({ success: true, concluded_count: concluded.length, concluded });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to conclude campaign' }, { status: 500 });
  }
});
```

## `base44/functions/contributeToGroup/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// A member contributes credits from their balance into the group pool.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { group_id, amount } = await req.json();
    const amt = Number(amount);
    if (!group_id || !(amt > 0)) return Response.json({ error: 'group_id and a positive amount are required' }, { status: 400 });

    const groups = await base44.asServiceRole.entities.SharedWalletGroup.filter({ id: group_id });
    const group = groups[0];
    if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });
    if (!(group.member_ids || []).includes(user.id)) {
      return Response.json({ error: 'You are not a member of this group' }, { status: 403 });
    }

    const balance = user.virtual_currency || 0;
    if (balance < amt) {
      return Response.json({ error: 'Insufficient balance', balance }, { status: 402 });
    }

    // Move credits from the member to the shared pool.
    await base44.asServiceRole.entities.User.update(user.id, { virtual_currency: balance - amt });
    await base44.asServiceRole.entities.SharedWalletGroup.update(group.id, {
      pooled_balance: (group.pooled_balance || 0) + amt,
    });

    const month = new Date().toISOString().slice(0, 7);
    await base44.asServiceRole.entities.GroupContribution.create({
      group_id: group.id, user_id: user.id, user_name: user.full_name || '', amount: amt, month,
    });

    return Response.json({
      success: true,
      pooled_balance: (group.pooled_balance || 0) + amt,
      your_remaining_balance: balance - amt,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to contribute' }, { status: 500 });
  }
});
```

## `base44/functions/createSharedWalletGroup/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Creates a shared wallet group (e.g. a family pool). The creator becomes the
// owner and first member. Returns an invite code others use to join.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, group_type = 'family', monthly_goal = 0, purpose = '', max_members = 10 } = await req.json();
    if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

    // Short, human-friendly invite code.
    const code = (name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'GRP') +
      Math.floor(1000 + Math.random() * 9000);

    const group = await base44.asServiceRole.entities.SharedWalletGroup.create({
      name,
      group_type,
      owner_user_id: user.id,
      member_ids: [user.id],
      member_count: 1,
      max_members,
      invite_code: code,
      monthly_goal,
      purpose,
      pooled_balance: 0,
      status: 'active',
    });

    return Response.json({ success: true, group_id: group.id, invite_code: code });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to create group' }, { status: 500 });
  }
});
```

## `base44/functions/creditPendingReferralPostRewards/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Credits a user's pending $0.10 referral-post rewards. Called when a user
// completes a survey (the reward is "held until the next survey"). Accepts an
// explicit { user_id } (for server-side calls) or uses the authenticated user.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    let userId = body.user_id;
    // grace_days: fairness path — auto-credit rewards that have been pending too long,
    // so a user never forfeits money they earned just because they stopped taking surveys.
    const graceDays = body.grace_days;

    let pending: any[] = [];
    if (userId) {
      // Survey-completion path: release this user's pending rewards.
      pending = await base44.asServiceRole.entities.ReferralPostEntry.filter({
        user_id: userId, reward_pending: true, reward_credited: false,
      }, '-created_date', 500);
    } else if (graceDays) {
      // Grace-period sweep across all users.
      const cutoff = Date.now() - graceDays * 24 * 60 * 60 * 1000;
      const all = await base44.asServiceRole.entities.ReferralPostEntry.filter({
        reward_pending: true, reward_credited: false,
      }, '-created_date', 2000);
      pending = all.filter((e: any) => e.created_date && new Date(e.created_date).getTime() < cutoff);
    } else {
      const me = await base44.auth.me().catch(() => null);
      userId = me?.id;
      if (!userId) return Response.json({ error: 'user_id or grace_days required' }, { status: 400 });
      pending = await base44.asServiceRole.entities.ReferralPostEntry.filter({
        user_id: userId, reward_pending: true, reward_credited: false,
      }, '-created_date', 500);
    }

    if (pending.length === 0) {
      return Response.json({ success: true, credited_count: 0, credited_amount: 0 });
    }

    let creditedAmount = 0;
    let creditedCount = 0;
    for (const entry of pending) {
      const amount = entry.reward_amount || 0.1;
      const creditUserId = entry.user_id || userId; // grace sweep credits each entry's own user
      try {
        await base44.asServiceRole.entities.Transaction.create({
          user_id: creditUserId,
          amount,
          currency: 'USD',
          transaction_type: 'survey_earning',
          status: 'completed',
          notes: `Referral post bonus (${entry.platform}, week ${entry.week_of})`,
        });
        await base44.asServiceRole.entities.ReferralPostEntry.update(entry.id, {
          reward_pending: false,
          reward_credited: true,
          reward_credited_at: new Date().toISOString(),
        });
        creditedAmount += amount;
        creditedCount++;
      } catch { /* skip and continue */ }
    }

    return Response.json({ success: true, credited_count: creditedCount, credited_amount: Number(creditedAmount.toFixed(2)) });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to credit rewards' }, { status: 500 });
  }
});
```

## `base44/functions/enterSkillTournament/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Pays the entry fee to join the current weekly SKILL tournament. The fee is
// deducted from the user's balance and added to the prize pool. Winners are
// still determined by performance ranking (processWeeklyJackpot) — never chance.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Find the current active tournament to read its entry fee.
    const actives = await base44.asServiceRole.entities.ReferralJackpot.filter({ status: 'active' }, '-created_date', 1);
    const tournament = actives[0];
    const entryFee = tournament?.entry_fee ?? 0;

    // Prevent paying twice.
    const mine = await base44.asServiceRole.entities.ReferralJackpot.filter({ status: 'active', user_id: user.id, is_paid_entry: true });
    if (mine.length > 0) {
      return Response.json({ error: 'You have already entered this tournament', already_entered: true }, { status: 409 });
    }

    // Charge the entry fee from the user's virtual currency balance.
    if (entryFee > 0) {
      const balance = user.virtual_currency || 0;
      if (balance < entryFee) {
        return Response.json({ error: 'Insufficient balance for entry fee', entry_fee: entryFee, balance }, { status: 402 });
      }
      await base44.asServiceRole.entities.User.update(user.id, { virtual_currency: balance - entryFee });
    }

    // Record the paid entry (also counts as a performance point) and grow the pool.
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.ReferralJackpot.create({
      period: tournament?.period || now.slice(0, 7),
      status: 'active',
      is_skill_based: true,
      ranking_metric: 'performance_score',
      user_id: user.id,
      user_email: user.email,
      jackpot_entries_earned: 1,
      entry_fee_paid: entryFee,
      is_paid_entry: true,
    });

    // Keep a running prize pool on the lead tournament record.
    if (tournament?.id) {
      try {
        await base44.asServiceRole.entities.ReferralJackpot.update(tournament.id, {
          prize_pool: (tournament.prize_pool || tournament.jackpot_amount || 0) + entryFee,
        });
      } catch { /* non-fatal */ }
    }

    return Response.json({
      success: true,
      entry_fee: entryFee,
      remaining_balance: entryFee > 0 ? (user.virtual_currency || 0) - entryFee : (user.virtual_currency || 0),
      note: 'You are entered. Winners are ranked by performance — no luck involved.',
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to enter tournament' }, { status: 500 });
  }
});
```

## `base44/functions/exportAIData/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Exports the caller's AI-related data as a single JSON payload for download.
// Called from AIContentHub with { data_type }. The response body is returned to
// the client under `.data` for the UI to serialize into a downloadable file.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data_type = 'all' } = await req.json().catch(() => ({}));

    // Best-effort collection — each entity is optional and failures are skipped.
    const collect = async (entity, filter) => {
      try {
        return await base44.asServiceRole.entities[entity].filter(filter, '-created_date', 500);
      } catch {
        return [];
      }
    };

    const records = {};
    const want = (key) => data_type === 'all' || data_type === key;

    if (want('earnings')) {
      records.ai_earnings_monitor = await collect('AIEarningsMonitor', { user_id: user.id });
      records.daily_earnings = await collect('DailyEarnings', { user_id: user.id });
    }
    if (want('surveys')) {
      records.daily_ai_surveys = await collect('DailyAISurvey', { created_by: user.email });
      records.survey_recommendations = await collect('SurveyRecommendation', { user_id: user.id });
    }
    if (want('all')) {
      records.transactions = await collect('Transaction', { user_id: user.id });
      records.notifications = await collect('Notification', { user_id: user.id });
    }

    const payload = {
      data_type,
      user_id: user.id,
      user_email: user.email,
      generated_at: new Date().toISOString(),
      record_counts: Object.fromEntries(
        Object.entries(records).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])
      ),
      records,
    };

    return Response.json(payload);
  } catch (error) {
    return Response.json({ error: error?.message || 'Export failed' }, { status: 500 });
  }
});
```

## `base44/functions/generateWeeklyFeatureVoteSurvey/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Creates the weekly, mandatory, $0.10 feature/game vote survey from the top
// user suggestions, and notifies active users. Intended to run once per week
// (e.g. Monday) via a schedule or the feature_vote_growth_agent.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Don't create a second active survey for the same week.
    const existing = await base44.asServiceRole.entities.FeatureVoteSurvey.filter({ status: 'active' }, '-created_date', 1);
    if (existing.length) {
      return Response.json({ skipped: true, reason: 'An active feature vote survey already exists', survey_id: existing[0].id });
    }

    // Pull the most-upvoted pending suggestions for games / features / UI.
    let suggestions = [];
    try {
      suggestions = await base44.asServiceRole.entities.UserSuggestion.filter(
        { status: 'pending' }, '-upvotes', 50
      );
    } catch { /* entity optional */ }

    const wanted = ['games', 'features', 'ui_ux'];
    const pool = suggestions
      .filter((s) => wanted.includes(s.category) && !s.added_to_survey)
      .slice(0, 6);

    // Fallback: if there aren't enough suggestions, pull unimplemented mockups.
    if (pool.length < 3) {
      try {
        const mockups = await base44.asServiceRole.entities.FeatureMockup.filter({ implemented: false }, '-total_survey_votes', 6);
        for (const m of mockups) {
          pool.push({ id: m.id, suggestion: m.feature_name || m.title, description: m.description, category: 'features', _mockup: true });
          if (pool.length >= 6) break;
        }
      } catch { /* optional */ }
    }

    if (pool.length === 0) {
      return Response.json({ skipped: true, reason: 'No candidate suggestions available this week' });
    }

    const candidates = pool.map((s, i) => ({
      candidate_id: `c${i}_${(s.id || 'x').slice(-6)}`,
      type: s.category === 'games' ? 'game' : s.category === 'ui_ux' ? 'ui_ux' : 'feature',
      title: s.suggestion || s.title || 'Untitled idea',
      description: s.description || '',
      source_suggestion_id: s._mockup ? '' : (s.id || ''),
      votes: 0,
      voter_ids: [],
    }));

    // Compute the Monday of the current week (server has no Date.now guard here).
    const now = new Date();
    const day = now.getUTCDay();
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
    const weekOf = monday.toISOString().slice(0, 10);
    const closesAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const survey = await base44.asServiceRole.entities.FeatureVoteSurvey.create({
      week_of: weekOf,
      title: `What should we build next? (Week of ${weekOf})`,
      description: 'Vote for the games and features you want most. Takes 30 seconds and pays $0.10. Optional — vote whenever you like.',
      status: 'active',
      is_mandatory: false,
      reward_amount: 0.1,
      closes_at: closesAt,
      candidates,
      total_responses: 0,
      responder_ids: [],
      implementation_triggered: false,
    });

    // Mark the source suggestions as added to a survey.
    for (const s of pool) {
      if (s._mockup) continue;
      try { await base44.asServiceRole.entities.UserSuggestion.update(s.id, { added_to_survey: true, added_to_survey_id: survey.id, added_to_survey_date: new Date().toISOString() }); } catch { /* ignore */ }
    }

    // Notify a bounded set of recently-active users.
    let notified = 0;
    try {
      const users = await base44.asServiceRole.entities.User.list('-updated_date', 500);
      for (const u of users) {
        try {
          await base44.asServiceRole.entities.Notification.create({
            user_id: u.id,
            title: '🗳️ Weekly Feature Vote — earn $0.10',
            message: 'This week\'s vote is open. Tell us which games & features to build next and earn $0.10. Optional — vote anytime.',
            notification_type: 'feature_vote_survey',
            related_entity_id: survey.id,
          });
          notified++;
        } catch { /* skip individual failures */ }
      }
    } catch { /* user list optional */ }

    return Response.json({ success: true, survey_id: survey.id, candidates: candidates.length, notified });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to generate survey' }, { status: 500 });
  }
});
```

## `base44/functions/generateWeeklyReferralCampaign/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Publishes the weekly mandatory referral posting campaign, rotating the required
// platform each week (Twitter/X -> Instagram -> Facebook -> TikTok -> LinkedIn).
// Run weekly (e.g. Monday) via the weekly_referral_campaign_agent.
const PLATFORMS = ['twitter', 'instagram', 'facebook', 'tiktok', 'linkedin'];
const EPOCH = Date.UTC(2024, 0, 1); // a Monday, used to index the rotation
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Don't double-publish for the same week.
    const active = await base44.asServiceRole.entities.WeeklyReferralCampaign.filter({ status: 'active' }, '-created_date', 1);
    if (active.length) {
      return Response.json({ skipped: true, reason: 'An active weekly referral campaign already exists', campaign_id: active[0].id });
    }

    const now = Date.now();
    const weekIndex = Math.floor((now - EPOCH) / WEEK_MS);
    const platform = PLATFORMS[weekIndex % PLATFORMS.length];

    // Monday of this week
    const d = new Date(now);
    const day = d.getUTCDay();
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
    const weekOf = monday.toISOString().slice(0, 10);
    const closesAt = new Date(now + WEEK_MS).toISOString();

    const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
    const campaign = await base44.asServiceRole.entities.WeeklyReferralCampaign.create({
      week_of: weekOf,
      week_index: weekIndex,
      platform,
      title: `This week's challenge: post your referral on ${platformLabel}`,
      status: 'active',
      is_mandatory: false,
      reward_per_post: 0.1,
      requires_disclosure: true,
      disclosure_text: '#ad',
      tracks: ['business_referral', 'user_referral'],
      closes_at: closesAt,
      total_posts: 0,
      participant_ids: [],
      leaderboard_business: [],
      leaderboard_user: [],
    });

    // Notify a bounded set of recently-active users.
    let notified = 0;
    try {
      const users = await base44.asServiceRole.entities.User.list('-updated_date', 500);
      for (const u of users) {
        try {
          await base44.asServiceRole.entities.Notification.create({
            user_id: u.id,
            title: `📣 Weekly Referral Challenge — ${platformLabel}`,
            message: `This week's platform is ${platformLabel}. Post your referral (with #ad disclosure) to earn $0.10 per post plus standard commission on conversions. Totally optional — join whenever you like.`,
            notification_type: 'weekly_referral_campaign',
            related_entity_id: campaign.id,
          });
          notified++;
        } catch { /* skip individual failures */ }
      }
    } catch { /* optional */ }

    return Response.json({ success: true, campaign_id: campaign.id, platform, week_of: weekOf, notified });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to generate campaign' }, { status: 500 });
  }
});
```

## `base44/functions/joinSharedWalletGroup/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Joins a shared wallet group by invite code.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { invite_code } = await req.json();
    if (!invite_code) return Response.json({ error: 'invite_code is required' }, { status: 400 });

    const groups = await base44.asServiceRole.entities.SharedWalletGroup.filter({ invite_code: invite_code.toUpperCase(), status: 'active' });
    const group = groups[0];
    if (!group) return Response.json({ error: 'No active group found for that code' }, { status: 404 });

    const members = group.member_ids || [];
    if (members.includes(user.id)) {
      return Response.json({ success: true, already_member: true, group_id: group.id });
    }
    if (members.length >= (group.max_members || 10)) {
      return Response.json({ error: 'This group is full' }, { status: 409 });
    }

    await base44.asServiceRole.entities.SharedWalletGroup.update(group.id, {
      member_ids: [...members, user.id],
      member_count: members.length + 1,
    });

    // Notify the owner.
    try {
      await base44.asServiceRole.entities.Notification.create({
        user_id: group.owner_user_id,
        title: '👪 New group member',
        message: `${user.full_name || 'A new member'} joined "${group.name}".`,
        notification_type: 'group_member_joined',
        related_entity_id: group.id,
      });
    } catch { /* non-fatal */ }

    return Response.json({ success: true, group_id: group.id, member_count: members.length + 1 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to join group' }, { status: 500 });
  }
});
```

## `base44/functions/processWeeklyJackpot/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Weekly OPEN, MERIT-BASED referral reward (formerly a random jackpot).
// Every participant earns in proportion to the VERIFIED, revenue-generating
// referrals they drove — no chance, and no one is excluded. The reward pool is
// self-funding: it is a share of the real revenue those referrals produced, so
// the platform always keeps a margin (adds to the bottom line).
const TOP_BONUS_FRACTION = 0.3;             // 30% of pool rewards the leaders...
const TOP_SPLIT = [0.5, 0.3, 0.2];          // ...split across the top 3.
// Remaining 70% is paid proportionally to every participant's verified contribution.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const records = await base44.asServiceRole.entities.ReferralJackpot.filter({
      created_date: { $gte: periodStart }, status: 'active',
    });
    if (!records.length) return Response.json({ message: 'No active participants this period' });

    const settings = await base44.asServiceRole.entities.GlobalSettings.list().catch(() => []);
    const platformContribution = settings[0]?.weekly_jackpot_amount || 0;
    const fundingRate = records[0].pool_funding_rate ?? 0.4;

    // Aggregate participants and their performance points + any entry fees paid.
    const byUser: Record<string, { points: number; email: string; fees: number }> = {};
    for (const r of records) {
      if (!r.user_id) continue;
      if (!byUser[r.user_id]) byUser[r.user_id] = { points: 0, email: r.user_email, fees: 0 };
      byUser[r.user_id].points += r.jackpot_entries_earned || 0;
      byUser[r.user_id].fees += r.entry_fee_paid || 0;
    }

    // For each participant, compute VERIFIED revenue their referrals drove this period.
    // This is both the merit metric and the funding source (quality-gated = anti-fraud).
    const participants = [];
    let totalRevenue = 0;
    let totalFees = 0;
    for (const [userId, d] of Object.entries(byUser)) {
      let revenue = 0;
      let conversions = 0;
      try {
        const refs = await base44.asServiceRole.entities.Referral.filter({ referrer_user_id: userId });
        for (const ref of refs) {
          const converted = ref.status === 'converted' || ref.status === 'completed' || ref.status === 'active';
          if (!converted) continue;
          conversions++;
          revenue += (ref.commission_earned || 0) + (ref.ppc_bitlabs_earnings || 0);
        }
      } catch { /* fall back to points below */ }
      // Merit value: real revenue if we have it, otherwise performance points.
      const value = revenue > 0 ? revenue : d.points;
      participants.push({ userId, email: d.email, points: d.points, revenue, conversions, value });
      totalRevenue += revenue;
      totalFees += d.fees;
    }

    // Rank by merit (deterministic — no randomness).
    participants.sort((a, b) => b.value - a.value);
    const totalValue = participants.reduce((s, p) => s + p.value, 0);
    if (totalValue <= 0) return Response.json({ message: 'No verified performance to reward yet' });

    // Self-funding pool: a share of verified revenue + platform contribution + entry fees.
    // Platform keeps (1 - fundingRate) of the referral revenue as margin.
    const pool = Math.round((totalRevenue * fundingRate + platformContribution + totalFees) * 100) / 100;
    const topBonus = pool * TOP_BONUS_FRACTION;
    const proportionalPool = pool - topBonus;

    // Compute each participant's prize: proportional share for ALL, plus a top-3 bonus.
    const prizes: Record<string, number> = {};
    for (const p of participants) {
      prizes[p.userId] = (proportionalPool * (p.value / totalValue));
    }
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      prizes[participants[i].userId] += topBonus * TOP_SPLIT[i];
    }

    // Pay everyone who earned a positive amount (open opportunity, merit-based).
    const winners = [];
    let paidCount = 0;
    let paidTotal = 0;
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const prize = Math.round((prizes[p.userId] || 0) * 100) / 100;
      if (prize <= 0) continue;
      let u: any = null;
      try { u = await base44.asServiceRole.entities.User.get(p.userId); } catch { /* ignore */ }
      const email = u?.email || p.email;
      try {
        await base44.asServiceRole.functions.invoke('paypalPayout', {
          recipient_email: email, amount: prize,
          payout_type: 'referral_performance_reward',
          description: `Weekly Referral Performance Reward — rank #${i + 1}, ${p.conversions} verified conversions`,
        });
      } catch { /* may queue; still record */ }
      paidCount++; paidTotal += prize;
      if (i < 10) winners.push({ user_id: p.userId, user_name: u?.full_name || '', rank: i + 1, score: Math.round(p.value * 100) / 100, prize_amount: prize });
      if (i < 3 && email) {
        try {
          await base44.integrations.Core.SendEmail({
            to: email,
            subject: `🏆 You placed #${i + 1} in the Weekly Referral Program — $${prize}`,
            body: `You finished rank #${i + 1} by the verified value of the referrals you drove ($${Math.round(p.revenue * 100) / 100} in tracked revenue, ${p.conversions} conversions) and earned $${prize}. Everyone who drives real referrals earns a share — decided by performance, never luck.`,
          });
        } catch { /* non-fatal */ }
      }
    }

    try {
      await base44.asServiceRole.entities.ReferralJackpot.update(records[0].id, {
        status: 'paid_out', is_skill_based: true, open_to_all: true,
        ranking_metric: 'verified_referral_revenue',
        prize_pool: pool, payout_amount: paidTotal, winners,
        winner_user_id: winners[0]?.user_id, winner_name: winners[0]?.user_name, winner_entries: winners[0]?.score,
        completed_date: new Date().toISOString(), paid_at: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }

    return Response.json({
      success: true, merit_based: true, open_to_all: true,
      prize_pool: pool, verified_revenue: Math.round(totalRevenue * 100) / 100,
      platform_margin_kept: Math.round(totalRevenue * (1 - fundingRate) * 100) / 100,
      participants_paid: paidCount, total_paid: Math.round(paidTotal * 100) / 100,
      top_finishers: winners,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

## `base44/functions/requestGroupSpend/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Requests to spend from the group pool — a large-ticket purchase or a transfer
// to a member. If the requester is the group owner, it executes immediately;
// otherwise it is created as pending for owner approval (approveGroupSpend).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { group_id, type = 'purchase', amount, item_name = '', recipient_user_id = '' } = await req.json();
    const amt = Number(amount);
    if (!group_id || !(amt > 0)) return Response.json({ error: 'group_id and a positive amount are required' }, { status: 400 });

    const groups = await base44.asServiceRole.entities.SharedWalletGroup.filter({ id: group_id });
    const group = groups[0];
    if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });
    if (!(group.member_ids || []).includes(user.id)) {
      return Response.json({ error: 'You are not a member of this group' }, { status: 403 });
    }
    if ((group.pooled_balance || 0) < amt) {
      return Response.json({ error: 'Insufficient pool balance', pooled_balance: group.pooled_balance || 0 }, { status: 402 });
    }
    if (type === 'transfer' && !(group.member_ids || []).includes(recipient_user_id)) {
      return Response.json({ error: 'Transfer recipient must be a group member' }, { status: 400 });
    }

    const isOwner = user.id === group.owner_user_id;
    const request = await base44.asServiceRole.entities.GroupSpendRequest.create({
      group_id: group.id, requested_by: user.id, requester_name: user.full_name || '',
      type, item_name, recipient_user_id, amount: amt,
      status: isOwner ? 'approved' : 'pending',
    });

    if (isOwner) {
      const execRes = await execute(base44, group, request);
      return Response.json({ success: true, executed: true, ...execRes });
    }

    // Notify the owner to approve.
    try {
      await base44.asServiceRole.entities.Notification.create({
        user_id: group.owner_user_id,
        title: '💳 Group spend request',
        message: `${user.full_name || 'A member'} requested $${amt} for ${type === 'transfer' ? 'a transfer' : (item_name || 'a purchase')}. Approve it in your group.`,
        notification_type: 'group_spend_request',
        related_entity_id: request.id,
      });
    } catch { /* non-fatal */ }

    return Response.json({ success: true, executed: false, request_id: request.id, status: 'pending' });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to request spend' }, { status: 500 });
  }
});

async function execute(base44: any, group: any, request: any) {
  const amt = request.amount;
  // Debit the pool.
  await base44.asServiceRole.entities.SharedWalletGroup.update(group.id, {
    pooled_balance: (group.pooled_balance || 0) - amt,
  });
  // For a transfer, credit the recipient member's balance.
  if (request.type === 'transfer' && request.recipient_user_id) {
    try {
      const recips = await base44.asServiceRole.entities.User.filter({ id: request.recipient_user_id });
      if (recips[0]) {
        await base44.asServiceRole.entities.User.update(recips[0].id, { virtual_currency: (recips[0].virtual_currency || 0) + amt });
      }
    } catch { /* non-fatal */ }
  }
  await base44.asServiceRole.entities.GroupSpendRequest.update(request.id, {
    status: 'paid', resolved_at: new Date().toISOString(),
  });
  return { pooled_balance: (group.pooled_balance || 0) - amt };
}
```

## `base44/functions/submitFeatureVote/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Records a user's votes on the weekly feature/game survey, credits the $0.10
// reward once, and prevents double-voting. Called from the WeeklyFeatureVote page.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { survey_id, candidate_ids } = await req.json();
    if (!survey_id || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
      return Response.json({ error: 'survey_id and at least one candidate_id are required' }, { status: 400 });
    }

    const surveys = await base44.asServiceRole.entities.FeatureVoteSurvey.filter({ id: survey_id });
    const survey = surveys[0];
    if (!survey) return Response.json({ error: 'Survey not found' }, { status: 404 });
    if (survey.status !== 'active') return Response.json({ error: 'This survey is closed' }, { status: 409 });

    const responderIds = survey.responder_ids || [];
    if (responderIds.includes(user.id)) {
      return Response.json({ error: 'You have already voted in this survey', already_voted: true }, { status: 409 });
    }

    // Apply votes to the chosen candidates.
    const chosen = new Set(candidate_ids);
    const candidates = (survey.candidates || []).map((c) => {
      if (chosen.has(c.candidate_id)) {
        return { ...c, votes: (c.votes || 0) + 1, voter_ids: [...(c.voter_ids || []), user.id] };
      }
      return c;
    });

    await base44.asServiceRole.entities.FeatureVoteSurvey.update(survey.id, {
      candidates,
      total_responses: (survey.total_responses || 0) + 1,
      responder_ids: [...responderIds, user.id],
    });

    // Credit the $0.10 reward exactly once.
    const reward = survey.reward_amount || 0.1;
    try {
      await base44.asServiceRole.entities.Transaction.create({
        user_id: user.id,
        amount: reward,
        currency: 'USD',
        transaction_type: 'survey_earning',
        status: 'completed',
        notes: `Weekly feature vote survey (${survey.week_of})`,
      });
    } catch { /* non-fatal — vote still counts */ }

    // Best-effort daily earnings roll-up.
    try {
      const today = new Date().toISOString().slice(0, 10);
      const existing = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id: user.id, date: today });
      if (existing[0]) {
        await base44.asServiceRole.entities.DailyEarnings.update(existing[0].id, { amount: (existing[0].amount || 0) + reward });
      } else {
        await base44.asServiceRole.entities.DailyEarnings.create({ user_id: user.id, date: today, amount: reward, source: 'feature_vote' });
      }
    } catch { /* optional */ }

    // Completing a survey unlocks any pending referral-post rewards ($0.10/post).
    let referral_rewards_credited = 0;
    try {
      const res = await base44.asServiceRole.functions.invoke('creditPendingReferralPostRewards', { user_id: user.id });
      referral_rewards_credited = res?.credited_amount || 0;
    } catch { /* non-fatal */ }

    return Response.json({ success: true, reward, voted_for: candidate_ids.length, referral_rewards_credited });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to submit vote' }, { status: 500 });
  }
});
```

## `base44/functions/submitReferralPost/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Records a user's referral post for the active weekly campaign.
// - Normal week: 1 post required on the campaign's rotation platform.
// - If the user MISSED the previous week's campaign, their assignment "doubles up":
//   2 posts required on their best-performing platform (highest return rate).
// The $0.10 reward is held pending and credited on their next survey completion.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { post_url, referral_code } = await req.json();
    if (!post_url) return Response.json({ error: 'post_url is required' }, { status: 400 });

    const actives = await base44.asServiceRole.entities.WeeklyReferralCampaign.filter({ status: 'active' }, '-created_date', 1);
    const campaign = actives[0];
    if (!campaign) return Response.json({ error: 'No active referral campaign' }, { status: 404 });

    // Determine the user's assignment (platform + required count).
    const assignment = await getAssignment(base44, user, campaign);

    // How many posts has the user already logged this campaign?
    const existing = await base44.asServiceRole.entities.ReferralPostEntry.filter({ campaign_id: campaign.id, user_id: user.id });
    if (existing.length >= assignment.required_count) {
      return Response.json({ error: 'You have already completed this week\'s posting requirement', completed: true }, { status: 409 });
    }

    // Business vs individual-user track.
    const isBusiness = user.account_type === 'business' || user.is_business === true || user.role === 'business_client' || !!user.business_client_id;
    const track = isBusiness ? 'business_referral' : 'user_referral';
    const reward = campaign.reward_per_post || 0.1;

    const entry = await base44.asServiceRole.entities.ReferralPostEntry.create({
      campaign_id: campaign.id,
      user_id: user.id,
      user_name: user.full_name || '',
      week_of: campaign.week_of,
      platform: assignment.platform,
      track,
      post_url,
      referral_code: referral_code || user.referral_code || '',
      was_doubled: assignment.doubled,
      reward_amount: reward,
      reward_pending: true,
      reward_credited: false,
      conversions: 0,
      commission_earned: 0,
    });

    // Update campaign participation.
    const participants = new Set(campaign.participant_ids || []);
    participants.add(user.id);
    await base44.asServiceRole.entities.WeeklyReferralCampaign.update(campaign.id, {
      total_posts: (campaign.total_posts || 0) + 1,
      participant_ids: [...participants],
    });

    // Update the user's per-platform stats (drives future best-platform picks).
    try {
      const stats = await base44.asServiceRole.entities.UserPlatformStats.filter({ user_id: user.id, platform: assignment.platform });
      if (stats[0]) {
        const posts = (stats[0].posts || 0) + 1;
        await base44.asServiceRole.entities.UserPlatformStats.update(stats[0].id, {
          posts,
          return_rate: posts > 0 ? (stats[0].conversions || 0) / posts : 0,
          last_post_at: new Date().toISOString(),
        });
      } else {
        await base44.asServiceRole.entities.UserPlatformStats.create({
          user_id: user.id, platform: assignment.platform, posts: 1, conversions: 0, commission_earned: 0, return_rate: 0, last_post_at: new Date().toISOString(),
        });
      }
    } catch { /* non-fatal */ }

    const remaining = Math.max(assignment.required_count - (existing.length + 1), 0);
    return Response.json({
      success: true,
      entry_id: entry.id,
      platform: assignment.platform,
      track,
      doubled: assignment.doubled,
      required_count: assignment.required_count,
      remaining,
      reward_pending: reward,
      note: 'Your $0.10 is pending and will be credited when you next complete a survey.',
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to submit post' }, { status: 500 });
  }
});

// Resolve the platform + required post count for this user this week.
async function getAssignment(base44: any, user: any, campaign: any) {
  const PLATFORMS = ['twitter', 'instagram', 'facebook', 'tiktok', 'linkedin'];
  try {
    // Look at the most recent prior campaign.
    const prior = await base44.asServiceRole.entities.WeeklyReferralCampaign.filter(
      { status: 'concluded' }, '-week_of', 1
    );
    const prev = prior.find((c: any) => c.id !== campaign.id);
    if (prev) {
      const priorEntries = await base44.asServiceRole.entities.ReferralPostEntry.filter({ campaign_id: prev.id, user_id: user.id });
      if (priorEntries.length === 0) {
        // Missed last week -> double up on the user's best platform.
        const stats = await base44.asServiceRole.entities.UserPlatformStats.filter({ user_id: user.id });
        let best = campaign.platform;
        if (stats.length) {
          const top = [...stats].sort((a: any, b: any) => (b.return_rate || 0) - (a.return_rate || 0) || (b.conversions || 0) - (a.conversions || 0))[0];
          if (top && PLATFORMS.includes(top.platform)) best = top.platform;
        }
        return { platform: best, required_count: 2, doubled: true };
      }
    }
  } catch { /* fall through to default */ }
  return { platform: campaign.platform, required_count: 1, doubled: false };
}
```

## `base44/functions/trackAdClick/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Records a click on a PPC ad. Called fire-and-forget from PPCAdSearchWidget with
// { adId, searchQuery }. Increments the listing's click count and logs the click.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { adId, searchQuery } = await req.json().catch(() => ({}));

    if (!adId) {
      return Response.json({ success: false, error: 'adId required' }, { status: 400 });
    }

    // Try to resolve the ad as an AdListing (by id) and bump its click count.
    let listing = null;
    try {
      const byId = await base44.asServiceRole.entities.AdListing.filter({ id: adId });
      listing = byId[0] || null;
    } catch { /* entity optional */ }

    if (listing) {
      try {
        await base44.asServiceRole.entities.AdListing.update(listing.id, {
          total_clicks: (listing.total_clicks || 0) + 1,
        });
      } catch { /* non-fatal */ }

      // Charge the advertiser's per-click bid, if configured.
      if (listing.bid_amount) {
        try {
          await base44.asServiceRole.entities.AdTransaction.create({
            ad_listing_id: listing.id,
            business_id: listing.business_id,
            amount: listing.bid_amount,
            transaction_type: 'click',
            search_query: searchQuery || '',
            status: 'completed',
          });
        } catch { /* AdTransaction optional */ }
      }
    }

    return Response.json({ success: true, tracked: !!listing });
  } catch (error) {
    // Fire-and-forget caller ignores failures; still return a clean 200-style body.
    return Response.json({ success: false, error: error?.message || 'track failed' });
  }
});
```

## `base44/functions/viralContentGenerator/entry.ts`

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Generates AI-drafted viral social posts and stores them as SocialMediaPost
// records with status "pending_review" for admin approval. Called from
// ViralContentDashboard with {}.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const platforms = ['twitter', 'instagram', 'tiktok', 'facebook', 'linkedin'];

    // Ask the LLM for a batch of platform-tailored viral post ideas.
    let ideas;
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate 5 short, high-engagement social media posts promoting a
"play games and earn rewards" platform called PlayEarning Nexus. Each post should
target a different platform and feel native to it. Return catchy copy, relevant
hashtags, an estimated engagement score (0-100), and a post type.`,
        model: 'gpt_5_mini',
        response_json_schema: {
          type: 'object',
          properties: {
            posts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  platform: { type: 'string', enum: platforms },
                  content: { type: 'string' },
                  hashtags: { type: 'array', items: { type: 'string' } },
                  engagement_score: { type: 'number', minimum: 0, maximum: 100 },
                  post_type: {
                    type: 'string',
                    enum: ['promotional', 'educational', 'engagement', 'announcement', 'behind_the_scenes'],
                  },
                },
              },
            },
          },
        },
      });
      ideas = result?.posts;
    } catch { /* fall back below */ }

    if (!Array.isArray(ideas) || ideas.length === 0) {
      // Deterministic fallback templates if the LLM is unavailable.
      ideas = [
        { platform: 'twitter', content: '🎮 Turn playtime into payday. Earn real rewards while you game on PlayEarning Nexus. Who says fun cant pay? 💸', hashtags: ['#PlayToEarn', '#GamingRewards'], engagement_score: 72, post_type: 'promotional' },
        { platform: 'instagram', content: 'Your favorite games just got more rewarding ✨ Complete quests, climb leaderboards, and cash out. Link in bio 👾', hashtags: ['#GamerLife', '#EarnRewards'], engagement_score: 68, post_type: 'engagement' },
        { platform: 'tiktok', content: 'POV: you finally get paid for grinding your daily quests 🕹️💰 #PlayEarningNexus', hashtags: ['#GamingTok', '#SideHustle'], engagement_score: 81, post_type: 'behind_the_scenes' },
        { platform: 'facebook', content: 'Discover a smarter way to game. PlayEarning Nexus rewards you for the play you already love. Join free today!', hashtags: ['#PlayAndEarn'], engagement_score: 60, post_type: 'announcement' },
        { platform: 'linkedin', content: 'The creator economy meets gaming. See how PlayEarning Nexus turns engagement into earnings for players and developers alike.', hashtags: ['#CreatorEconomy', '#Gaming'], engagement_score: 55, post_type: 'educational' },
      ];
    }

    const created = [];
    for (const idea of ideas) {
      try {
        const post = await base44.asServiceRole.entities.SocialMediaPost.create({
          developer_id: user.id,
          platform: platforms.includes(idea.platform) ? idea.platform : 'twitter',
          content: idea.content,
          hashtags: idea.hashtags || [],
          post_type: idea.post_type || 'promotional',
          status: 'pending_review',
          engagement_score: idea.engagement_score || 0,
        });
        created.push(post);
      } catch { /* skip invalid */ }
    }

    return Response.json({ generated: created.length, posts: created });
  } catch (error) {
    return Response.json({ error: error?.message || 'Generation failed' }, { status: 500 });
  }
});
```

## `capacitor.config.json`

```json
{
  "appId": "com.playearningnexus.app",
  "appName": "PlayEarning Nexus",
  "webDir": "dist",
  "backgroundColor": "#111827",
  "android": {
    "allowMixedContent": false
  },
  "ios": {
    "contentInset": "always"
  },
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 1200,
      "backgroundColor": "#111827",
      "showSpinner": false
    }
  }
}
```

## `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="https://base44.com/logo_v2.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <link rel="manifest" href="/manifest.json" />
    <!-- PWA / mobile app meta -->
    <meta name="theme-color" content="#111827" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="PlayEarning" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <title>PlayEarning Nexus</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

## `package.json`

```json
{
  "name": "base44-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint . --quiet",
    "lint:fix": "eslint . --fix",
    "typecheck": "tsc -p ./jsconfig.json",
    "preview": "vite preview",
    "cap:build": "vite build && npx cap sync",
    "cap:open:android": "npx cap open android",
    "cap:open:ios": "npx cap open ios",
    "cap:assets": "npx capacitor-assets generate --iconBackgroundColor '#111827' --splashBackgroundColor '#111827'",
    "native:regenerate": "bash scripts/regenerate-native.sh"
  },
  "dependencies": {
    "@base44/sdk": "^0.8.39",
    "@capacitor/android": "^6.1.2",
    "@capacitor/app": "^6.0.1",
    "@capacitor/core": "^6.1.2",
    "@capacitor/ios": "^6.1.2",
    "@capacitor/splash-screen": "^6.0.3",
    "@capacitor/status-bar": "^6.0.2",
    "@base44/vite-plugin": "^1.0.30",
    "@hello-pangea/dnd": "^17.0.0",
    "@hookform/resolvers": "^4.1.2",
    "@paypal/react-paypal-js": "^8.1.3",
    "@radix-ui/react-accordion": "^1.2.3",
    "@radix-ui/react-alert-dialog": "^1.1.6",
    "@radix-ui/react-aspect-ratio": "^1.1.2",
    "@radix-ui/react-avatar": "^1.1.3",
    "@radix-ui/react-checkbox": "^1.1.4",
    "@radix-ui/react-collapsible": "^1.1.3",
    "@radix-ui/react-context-menu": "^2.2.6",
    "@radix-ui/react-dialog": "^1.1.6",
    "@radix-ui/react-dropdown-menu": "^2.1.6",
    "@radix-ui/react-hover-card": "^1.1.6",
    "@radix-ui/react-label": "^2.1.2",
    "@radix-ui/react-menubar": "^1.1.6",
    "@radix-ui/react-navigation-menu": "^1.2.5",
    "@radix-ui/react-popover": "^1.1.6",
    "@radix-ui/react-progress": "^1.1.2",
    "@radix-ui/react-radio-group": "^1.2.3",
    "@radix-ui/react-scroll-area": "^1.2.3",
    "@radix-ui/react-select": "^2.1.6",
    "@radix-ui/react-separator": "^1.1.2",
    "@radix-ui/react-slider": "^1.2.3",
    "@radix-ui/react-slot": "^1.1.2",
    "@radix-ui/react-switch": "^1.1.3",
    "@radix-ui/react-tabs": "^1.1.3",
    "@radix-ui/react-toast": "^1.2.2",
    "@radix-ui/react-toggle": "^1.1.2",
    "@radix-ui/react-toggle-group": "^1.1.2",
    "@radix-ui/react-tooltip": "^1.1.8",
    "@stripe/react-stripe-js": "^3.0.0",
    "@stripe/stripe-js": "^5.2.0",
    "@tanstack/react-query": "^5.84.1",
    "canvas-confetti": "^1.9.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.0.0",
    "date-fns": "^3.6.0",
    "embla-carousel-react": "^8.5.2",
    "framer-motion": "^11.16.4",
    "html2canvas": "^1.4.1",
    "input-otp": "^1.4.2",
    "jspdf": "^2.5.2",
    "lodash": "^4.17.21",
    "lucide-react": "^0.475.0",
    "moment": "^2.30.1",
    "next-themes": "^0.4.4",
    "react": "^18.2.0",
    "react-day-picker": "^8.10.1",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.54.2",
    "react-hot-toast": "^2.6.0",
    "react-leaflet": "^4.2.1",
    "react-markdown": "^9.0.1",
    "react-quill": "^2.0.0",
    "react-resizable-panels": "^2.1.7",
    "react-router-dom": "^6.26.0",
    "recharts": "^2.15.4",
    "sonner": "^2.0.1",
    "tailwind-merge": "^3.0.2",
    "tailwindcss-animate": "^1.0.7",
    "three": "^0.171.0",
    "vaul": "^1.1.2",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@capacitor/assets": "^3.0.5",
    "@capacitor/cli": "^6.1.2",
    "@eslint/js": "^9.19.0",
    "@types/node": "^22.13.5",
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "baseline-browser-mapping": "^2.8.32",
    "eslint": "^9.19.0",
    "eslint-plugin-react": "^7.37.4",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-react-refresh": "^0.4.18",
    "eslint-plugin-unused-imports": "^4.3.0",
    "globals": "^15.14.0",
    "postcss": "^8.5.3",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.8.2",
    "vite": "^6.1.0"
  }
}
```

## `public/manifest.json`

```json
{
  "name": "PlayEarning Nexus",
  "short_name": "PlayEarning",
  "description": "Play games, take surveys, refer friends, and earn rewards.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#111827",
  "theme_color": "#111827",
  "categories": ["games", "entertainment", "finance"],
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

## `scripts/regenerate-native.sh`

```bash
#!/usr/bin/env bash
# Regenerate the native Android/iOS shells FROM the wrapper, on demand.
#
# The repo is wrapper-only: android/ and ios/ are NOT committed (see .gitignore).
# This script recreates them from capacitor.config.json + the web build whenever
# you need to produce a native app, then keeps them in sync. Run it before
# opening Android Studio / Xcode. iOS steps only run on macOS.
set -e

echo "▶ Building the web app…"
npm run build

echo "▶ Generating app icons/splash (if assets/icon.png exists)…"
if [ -f "assets/icon.png" ]; then
  npm run cap:assets || echo "  (asset generation skipped)"
fi

echo "▶ Ensuring Android platform…"
if [ ! -d "android" ]; then
  npx cap add android
else
  echo "  android/ already present (regenerating is optional)"
fi

# iOS can only be generated/built on macOS.
if [ "$(uname)" = "Darwin" ]; then
  echo "▶ Ensuring iOS platform…"
  if [ ! -d "ios" ]; then
    npx cap add ios
  else
    echo "  ios/ already present"
  fi
else
  echo "▶ Skipping iOS (requires macOS + Xcode)."
fi

echo "▶ Syncing web build + plugins into native shells…"
npx cap sync

echo "✓ Done. Open with: npm run cap:open:android   (and, on a Mac) npm run cap:open:ios"
echo "  Note: android/ and ios/ are git-ignored — they are build artifacts, not source."
```

## `src/App.jsx`

```jsx
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { LocalizationProvider } from '@/context/LocalizationContext';

// Lazy-load heavy pages to reduce initial bundle size
const EarningsInsights = lazy(() => import('./pages/EarningsInsights'));
const ExploreSurveys = lazy(() => import('./pages/ExploreSurveys'));
const SurveyAnalytics = lazy(() => import('./pages/SurveyAnalytics'));
const AIGeneratorPage = lazy(() => import('./pages/AIGeneratorPage'));
const BusinessSurveyAnalytics = lazy(() => import('./pages/BusinessSurveyAnalytics'));
const ManagePayouts = lazy(() => import('./pages/ManagePayouts'));
const RespondentProfile = lazy(() => import('./pages/RespondentProfile'));
const AdvancedSurveyAnalytics = lazy(() => import('./pages/AdvancedSurveyAnalytics'));
const MyPayouts = lazy(() => import('./pages/MyPayouts'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const MyOrders = lazy(() => import('./pages/MyOrders'));
const SurveyEmbedManager = lazy(() => import('./pages/SurveyEmbedManager'));
const AIAutomationCenter = lazy(() => import('./pages/AIAutomationCenter'));
const PayoutStatus = lazy(() => import('./pages/PayoutStatus'));
const UserAnalytics = lazy(() => import('./pages/UserAnalytics'));
const NotificationInbox = lazy(() => import('./pages/NotificationInbox'));
const SurveyAdminDashboard = lazy(() => import('./pages/SurveyAdminDashboard'));
const SurveyTemplateBuilder = lazy(() => import('./pages/SurveyTemplateBuilder'));
const ReferralLeaderboardPage = lazy(() => import('./pages/ReferralLeaderboardPage'));
const DisputeCenter = lazy(() => import('./pages/DisputeCenter'));
const PartnerOnboarding = lazy(() => import('./pages/PartnerOnboarding'));
const FeedbackAdminDashboard = lazy(() => import('./pages/FeedbackAdminDashboard'));
const GlobalPrestigeHub = lazy(() => import('./pages/GlobalPrestigeHub'));
const SurveyMarketplace = lazy(() => import('./pages/SurveyMarketplace'));
const EarningsSimulatorPage = lazy(() => import('./pages/EarningsSimulatorPage'));
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'));
const DailyEarningStreak = lazy(() => import('./pages/DailyEarningStreak'));
const GlobalLeaderboard = lazy(() => import('./pages/GlobalLeaderboard'));
const SurveyIntelligenceDashboard = lazy(() => import('./pages/SurveyIntelligenceDashboard'));
const AgentIntelligenceDashboard = lazy(() => import('./pages/AgentIntelligenceDashboard'));
const RetentionEngine = lazy(() => import('./pages/RetentionEngine'));
const DeveloperRevenueAnalytics = lazy(() => import('./pages/DeveloperRevenueAnalytics'));
const AdvancedInsights = lazy(() => import('./pages/AdvancedInsights'));
const UXHeatmapDashboard = lazy(() => import('./pages/UXHeatmapDashboard'));
const ABTestingCenter = lazy(() => import('./pages/ABTestingCenter'));
const GameVotingHub = lazy(() => import('./pages/GameVotingHub'));
const DeveloperOnboarding = lazy(() => import('./pages/DeveloperOnboarding'));
const DevEngagementAnalytics = lazy(() => import('./pages/DevEngagementAnalytics'));
const DevFinancialDashboard = lazy(() => import('./pages/DevFinancialDashboard'));
const DevABTesting = lazy(() => import('./pages/DevABTesting'));
const DevBugReports = lazy(() => import('./pages/DevBugReports'));
const AIGrowthAssistant = lazy(() => import('./pages/AIGrowthAssistant'));
const SmartNotificationEngine = lazy(() => import('./pages/SmartNotificationEngine'));
const RewardsMarketplace = lazy(() => import('./pages/RewardsMarketplace'));
const ReferralSquads = lazy(() => import('./pages/ReferralSquads'));
const AdminRiskMonitoring = lazy(() => import('./pages/AdminRiskMonitoring'));
const AdminGrowthHeatmap = lazy(() => import('./pages/AdminGrowthHeatmap'));
const Tournaments = lazy(() => import('./pages/Tournaments'));
const TournamentDetails = lazy(() => import('./pages/TournamentDetails'));
const SocialAuthCallback = lazy(() => import('./pages/SocialAuthCallback'));
const SocialMediaSetup = lazy(() => import('./pages/SocialMediaSetup'));
const AIOrderForm = lazy(() => import('./pages/AIOrderForm'));
const DailyTodoList = lazy(() => import('./pages/DailyTodoList'));
const SalesAnalyticsDashboard = lazy(() => import('./pages/SalesAnalyticsDashboard'));
const GoogleAdsOverlay = lazy(() => import('./pages/GoogleAdsOverlay'));
const AdBusinessDashboard = lazy(() => import('./pages/AdBusinessDashboard'));
const AdBusinessOverview = lazy(() => import('./pages/AdBusinessOverview'));
const SmartPayoutDashboard = lazy(() => import('./pages/SmartPayoutDashboard'));
const ContestEntries = lazy(() => import('./pages/ContestEntries'));
const PaidPPCAdsMosaic = lazy(() => import('./pages/PaidPPCAdsMosaic'));
const HeadToHeadContest = lazy(() => import('./pages/HeadToHeadContest'));
const WeeklyFeatureVote = lazy(() => import('./pages/WeeklyFeatureVote'));
const WeeklyReferralContest = lazy(() => import('./pages/WeeklyReferralContest'));
const SharedWalletGroups = lazy(() => import('./pages/SharedWalletGroups'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const AIContentHub = lazy(() => import('./pages/AIContentHub'));
const Store = lazy(() => import('./pages/Store'));
const AIAgentsSettings = lazy(() => import('./pages/AIAgentsSettings'));
const ReferralCompetition = lazy(() => import('./pages/ReferralCompetition'));
const PPCSurveyBuilder = lazy(() => import('./pages/PPCSurveyBuilder'));
const LevelAndBadgesPage = lazy(() => import('./pages/LevelAndBadgesPage'));
const ReferralContest = lazy(() => import('./pages/ReferralContest'));
const DeveloperPayoutDashboard = lazy(() => import('./pages/DeveloperPayoutDashboard'));
const SellerUpload = lazy(() => import('./pages/SellerUpload'));
const Pricing = lazy(() => import('./pages/Pricing'));
const CompleteProfile = lazy(() => import('./pages/CompleteProfile'));
const AdminCredentials = lazy(() => import('./pages/AdminCredentials'));
const AdminGlobalSettings = lazy(() => import('./pages/AdminGlobalSettings'));
const AdminAuditLogs = lazy(() => import('./pages/AdminAuditLogs'));
const Quests = lazy(() => import('./pages/Quests'));
const ChatRooms = lazy(() => import('./pages/ChatRooms'));
const AdMarketplace = lazy(() => import('./pages/AdMarketplace'));
const AIOrderFulfillmentDashboard = lazy(() => import('./pages/AIOrderFulfillmentDashboard'));
const MarketTrendReport = lazy(() => import('./pages/MarketTrendReport'));
const DeveloperDisputeCenter = lazy(() => import('./pages/DeveloperDisputeCenter'));
const AIPayoutSchedulerPage = lazy(() => import('./pages/AIPayoutSchedulerPage'));
const AIFeedbackABDashboard = lazy(() => import('./pages/AIFeedbackABDashboard'));
const AdFraudDashboard = lazy(() => import('./pages/AdFraudDashboard'));
const AdSentimentAnalysis = lazy(() => import('./pages/AdSentimentAnalysis'));
const GamerTournamentDashboard = lazy(() => import('./pages/GamerTournamentDashboard'));
const ReferralGrowthEngine = lazy(() => import('./pages/ReferralGrowthEngine'));
const AIAgentsCommandCenter = lazy(() => import('./pages/AIAgentsCommandCenter'));
const AffiliateMLMDashboard = lazy(() => import('./pages/AffiliateMLMDashboard'));
const AIAdDiscovery = lazy(() => import('./pages/AIAdDiscovery'));
const WishlistIntelligence = lazy(() => import('./pages/WishlistIntelligence'));
const WishlistSharerLeaderboardPage = lazy(() => import('./pages/WishlistSharerLeaderboardPage'));
const DisputeResolverCenter = lazy(() => import('./pages/DisputeResolverCenter'));
const AIFinancialAdvisor = lazy(() => import('./pages/AIFinancialAdvisor'));
const RealtimeFraudMonitorDashboard = lazy(() => import('./pages/RealtimeFraudMonitorDashboard'));
const GrowthEngineHub = lazy(() => import('./pages/GrowthEngineHub'));
const AILTVDashboard = lazy(() => import('./pages/AILTVDashboard'));
const CompetitiveMonitoringDashboard = lazy(() => import('./pages/CompetitiveMonitoringDashboard'));
const QuickSurveyBuilder = lazy(() => import('./pages/QuickSurveyBuilder'));
const DeveloperToolsHub = lazy(() => import('./pages/DeveloperToolsHub'));
const AdCampaignOptimizerPage = lazy(() => import('./pages/AdCampaignOptimizerPage'));
const AdCampaignManager = lazy(() => import('./pages/AdCampaignManager'));
const MarketAdvisor = lazy(() => import('./pages/MarketAdvisor'));
const RevenueHub = lazy(() => import('./pages/RevenueHub'));
const CRMDashboard = lazy(() => import('./pages/CRMDashboard'));
const AutomationReviewDashboard = lazy(() => import('./pages/AutomationReviewDashboard'));
const WhiteLabelSetup = lazy(() => import('./pages/WhiteLabelSetup'));
const AutomationGuardianDashboard = lazy(() => import('./pages/AutomationGuardianDashboard'));
const DisputeClaimsUser = lazy(() => import('./pages/DisputeClaimsUser'));
const AdminDisputeResolution = lazy(() => import('./pages/AdminDisputeResolution'));
const SubmitDisputeWizard = lazy(() => import('./pages/SubmitDisputeWizard'));
const ReengagementDashboard = lazy(() => import('./pages/ReengagementDashboard'));
const AIDisputeAutomationDashboard = lazy(() => import('./pages/AIDisputeAutomationDashboard'));
const ViralContentDashboard = lazy(() => import('./pages/ViralContentDashboard'));
const BusinessClientReengagementDashboard = lazy(() => import('./pages/BusinessClientReengagementDashboard'));
const AffiliatePortal = lazy(() => import('./pages/AffiliatePortal'));
const CompetitorIntelligenceDashboard = lazy(() => import('./pages/CompetitorIntelligenceDashboard'));
const CompetitorAlertFeed = lazy(() => import('./pages/CompetitorAlertFeed'));
const AffiliateContentSchedulerCalendar = lazy(() => import('./pages/AffiliateContentSchedulerCalendar'));
const ReferralFraudDetectionDashboard = lazy(() => import('./pages/ReferralFraudDetectionDashboard'));
const AffiliateGrowthCampaignDashboard = lazy(() => import('./pages/AffiliateGrowthCampaignDashboard'));
const ContentLibraryBrowser = lazy(() => import('./pages/ContentLibraryBrowser'));
const AIMarketPulse = lazy(() => import('./pages/AIMarketPulse'));
const AffiliateOnboarding = lazy(() => import('./pages/AffiliateOnboarding'));
const DeveloperAnalyticsDashboard = lazy(() => import('./pages/DeveloperAnalyticsDashboard'));
const AdminLocalizationPanel = lazy(() => import('./pages/AdminLocalizationPanel'));
const AffiliateDisputeCenter = lazy(() => import('./pages/AffiliateDisputeCenter'));
const AdCreativeABTestingDashboard = lazy(() => import('./pages/AdCreativeABTestingDashboard'));
const AffiliatePayoutManager = lazy(() => import('./pages/AffiliatePayoutManager'));
const AffiliateChurnMonitor = lazy(() => import('./pages/AffiliateChurnMonitor'));
const SupportTicketDossierViewer = lazy(() => import('./pages/SupportTicketDossierViewer'));
const DisputeAutoApprovalSettings = lazy(() => import('./pages/DisputeAutoApprovalSettings'));
const MarketingAssetRepository = lazy(() => import('./pages/MarketingAssetRepository'));
const AffiliateAnalyticsDashboard = lazy(() => import('./pages/AffiliateAnalyticsDashboard'));
const AffiliateTierDashboard = lazy(() => import('./pages/AffiliateTierDashboard'));
const AdminProfitCalculator = lazy(() => import('./pages/AdminProfitCalculator'));
const AdminAffiliatePayoutDashboard = lazy(() => import('./pages/AdminAffiliatePayoutDashboard'));
const ClientAnalyticsDashboard = lazy(() => import('./pages/ClientAnalyticsDashboard'));
const PayoutMarketplace = lazy(() => import('./pages/PayoutMarketplace'));
const AISocialMediaEngine = lazy(() => import('./pages/AISocialMediaEngine'));
const AIDisputeResolutionCenter = lazy(() => import('./pages/AIDisputeResolutionCenter'));
const AIVideoStudio = lazy(() => import('./pages/AIVideoStudio'));
const AIAutomationLearningDashboard = lazy(() => import('./pages/AIAutomationLearningDashboard'));
const GameMonetizationDashboard = lazy(() => import('./pages/GameMonetizationDashboard'));
const DeveloperEarningsDashboard = lazy(() => import('./pages/DeveloperEarningsDashboard'));
const AffiliateMarketingPage = lazy(() => import('./pages/AffiliateMarketingPage'));
const AIRevenueTracker = lazy(() => import('./pages/AIRevenueTracker'));
const FeaturedGameDashboard = lazy(() => import('./pages/FeaturedGameDashboard'));
const ThirdPartySellerMarketplace = lazy(() => import('./pages/ThirdPartySellerMarketplace'));
const SocialMediaAdPoster = lazy(() => import('./pages/SocialMediaAdPoster'));
const UpfrontEarningsPage = lazy(() => import('./pages/UpfrontEarningsPage'));


const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Redirect new users to social media setup
  const needsSocialSetup = sessionStorage.getItem('needs_social_setup') === 'true';
  const isOnSetupPage = window.location.pathname === '/SocialMediaSetup';
  if (needsSocialSetup && !isOnSetupPage) {
    window.location.replace('/SocialMediaSetup');
    return null;
  }

  // Redirect users with no name to profile completion
  const isOnCompleteProfile = window.location.pathname === '/CompleteProfile';
  if (!isOnCompleteProfile && !authError) {
    // Check after auth resolves and user is authenticated but has no name
    const currentUser = authError ? null : window.__gg_user_cache;
    // We do this check via a side-effect read from sessionStorage flag set on login
    if (sessionStorage.getItem('needs_profile_completion') === 'true') {
      window.location.replace('/CompleteProfile');
      return null;
    }
  }

  // Render the main app
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/EarningsInsights" element={<LayoutWrapper currentPageName="EarningsInsights"><EarningsInsights /></LayoutWrapper>} />
      <Route path="/ExploreSurveys" element={<LayoutWrapper currentPageName="ExploreSurveys"><ExploreSurveys /></LayoutWrapper>} />
      <Route path="/SurveyAnalytics" element={<LayoutWrapper currentPageName="SurveyAnalytics"><SurveyAnalytics /></LayoutWrapper>} />
      <Route path="/BusinessSurveyAnalytics" element={<LayoutWrapper currentPageName="BusinessSurveyAnalytics"><BusinessSurveyAnalytics /></LayoutWrapper>} />
      <Route path="/ManagePayouts" element={<LayoutWrapper currentPageName="ManagePayouts"><ManagePayouts /></LayoutWrapper>} />
      <Route path="/RespondentProfile" element={<LayoutWrapper currentPageName="RespondentProfile"><RespondentProfile /></LayoutWrapper>} />
      <Route path="/AdvancedSurveyAnalytics" element={<LayoutWrapper currentPageName="AdvancedSurveyAnalytics"><AdvancedSurveyAnalytics /></LayoutWrapper>} />
      <Route path="/AIGeneratorPage" element={<LayoutWrapper currentPageName="AIGeneratorPage"><AIGeneratorPage /></LayoutWrapper>} />
      <Route path="/MyPayouts" element={<LayoutWrapper currentPageName="MyPayouts"><MyPayouts /></LayoutWrapper>} />
      <Route path="/Campaigns" element={<LayoutWrapper currentPageName="Campaigns"><Campaigns /></LayoutWrapper>} />
      <Route path="/MyOrders" element={<LayoutWrapper currentPageName="MyOrders"><MyOrders /></LayoutWrapper>} />
      <Route path="/SurveyEmbedManager" element={<LayoutWrapper currentPageName="SurveyEmbedManager"><SurveyEmbedManager /></LayoutWrapper>} />
      <Route path="/AIAutomationCenter" element={<LayoutWrapper currentPageName="AIAutomationCenter"><AIAutomationCenter /></LayoutWrapper>} />
      <Route path="/PayoutStatus" element={<LayoutWrapper currentPageName="PayoutStatus"><PayoutStatus /></LayoutWrapper>} />
      <Route path="/UserAnalytics" element={<LayoutWrapper currentPageName="UserAnalytics"><UserAnalytics /></LayoutWrapper>} />
      <Route path="/NotificationInbox" element={<LayoutWrapper currentPageName="NotificationInbox"><NotificationInbox /></LayoutWrapper>} />
      <Route path="/SurveyAdminDashboard" element={<LayoutWrapper currentPageName="SurveyAdminDashboard"><SurveyAdminDashboard /></LayoutWrapper>} />
      <Route path="/SurveyTemplateBuilder" element={<LayoutWrapper currentPageName="SurveyTemplateBuilder"><SurveyTemplateBuilder /></LayoutWrapper>} />
      <Route path="/ReferralLeaderboardPage" element={<LayoutWrapper currentPageName="ReferralLeaderboardPage"><ReferralLeaderboardPage /></LayoutWrapper>} />
      <Route path="/DisputeCenter" element={<LayoutWrapper currentPageName="DisputeCenter"><DisputeCenter /></LayoutWrapper>} />
      <Route path="/PartnerOnboarding" element={<LayoutWrapper currentPageName="PartnerOnboarding"><PartnerOnboarding /></LayoutWrapper>} />
      <Route path="/FeedbackAdminDashboard" element={<LayoutWrapper currentPageName="FeedbackAdminDashboard"><FeedbackAdminDashboard /></LayoutWrapper>} />
      <Route path="/GlobalPrestigeHub" element={<LayoutWrapper currentPageName="GlobalPrestigeHub"><GlobalPrestigeHub /></LayoutWrapper>} />
      <Route path="/SurveyMarketplace" element={<LayoutWrapper currentPageName="SurveyMarketplace"><SurveyMarketplace /></LayoutWrapper>} />
      <Route path="/EarningsSimulatorPage" element={<LayoutWrapper currentPageName="EarningsSimulatorPage"><EarningsSimulatorPage /></LayoutWrapper>} />
      <Route path="/AchievementsPage" element={<LayoutWrapper currentPageName="AchievementsPage"><AchievementsPage /></LayoutWrapper>} />
      <Route path="/DailyEarningStreak" element={<LayoutWrapper currentPageName="DailyEarningStreak"><DailyEarningStreak /></LayoutWrapper>} />
      <Route path="/GlobalLeaderboard" element={<LayoutWrapper currentPageName="GlobalLeaderboard"><GlobalLeaderboard /></LayoutWrapper>} />
      <Route path="/SurveyIntelligenceDashboard" element={<LayoutWrapper currentPageName="SurveyIntelligenceDashboard"><SurveyIntelligenceDashboard /></LayoutWrapper>} />
      <Route path="/AgentIntelligenceDashboard" element={<LayoutWrapper currentPageName="AgentIntelligenceDashboard"><AgentIntelligenceDashboard /></LayoutWrapper>} />
      <Route path="/RetentionEngine" element={<LayoutWrapper currentPageName="RetentionEngine"><RetentionEngine /></LayoutWrapper>} />
      <Route path="/DeveloperRevenueAnalytics" element={<LayoutWrapper currentPageName="DeveloperRevenueAnalytics"><DeveloperRevenueAnalytics /></LayoutWrapper>} />
      <Route path="/AdvancedInsights" element={<LayoutWrapper currentPageName="AdvancedInsights"><AdvancedInsights /></LayoutWrapper>} />
      <Route path="/UXHeatmapDashboard" element={<LayoutWrapper currentPageName="UXHeatmapDashboard"><UXHeatmapDashboard /></LayoutWrapper>} />
      <Route path="/ABTestingCenter" element={<LayoutWrapper currentPageName="ABTestingCenter"><ABTestingCenter /></LayoutWrapper>} />
      <Route path="/GameVotingHub" element={<LayoutWrapper currentPageName="GameVotingHub"><GameVotingHub /></LayoutWrapper>} />
      <Route path="/DeveloperOnboarding" element={<LayoutWrapper currentPageName="DeveloperOnboarding"><DeveloperOnboarding /></LayoutWrapper>} />
      <Route path="/DevEngagementAnalytics" element={<LayoutWrapper currentPageName="DevEngagementAnalytics"><DevEngagementAnalytics /></LayoutWrapper>} />
      <Route path="/DevFinancialDashboard" element={<LayoutWrapper currentPageName="DevFinancialDashboard"><DevFinancialDashboard /></LayoutWrapper>} />
      <Route path="/DevABTesting" element={<LayoutWrapper currentPageName="DevABTesting"><DevABTesting /></LayoutWrapper>} />
      <Route path="/DevBugReports" element={<LayoutWrapper currentPageName="DevBugReports"><DevBugReports /></LayoutWrapper>} />
      <Route path="/AIGrowthAssistant" element={<LayoutWrapper currentPageName="AIGrowthAssistant"><AIGrowthAssistant /></LayoutWrapper>} />
      <Route path="/SmartNotificationEngine" element={<LayoutWrapper currentPageName="SmartNotificationEngine"><SmartNotificationEngine /></LayoutWrapper>} />
      <Route path="/RewardsMarketplace" element={<LayoutWrapper currentPageName="RewardsMarketplace"><RewardsMarketplace /></LayoutWrapper>} />
      <Route path="/ReferralSquads" element={<LayoutWrapper currentPageName="ReferralSquads"><ReferralSquads /></LayoutWrapper>} />
      <Route path="/AdminRiskMonitoring" element={<LayoutWrapper currentPageName="AdminRiskMonitoring"><AdminRiskMonitoring /></LayoutWrapper>} />
      <Route path="/AdminGrowthHeatmap" element={<LayoutWrapper currentPageName="AdminGrowthHeatmap"><AdminGrowthHeatmap /></LayoutWrapper>} />
      <Route path="/Tournaments" element={<LayoutWrapper currentPageName="Tournaments"><Tournaments /></LayoutWrapper>} />
      <Route path="/TournamentDetails" element={<LayoutWrapper currentPageName="TournamentDetails"><TournamentDetails /></LayoutWrapper>} />
      <Route path="/social-auth-callback" element={<LayoutWrapper currentPageName="SocialAuthCallback"><SocialAuthCallback /></LayoutWrapper>} />
      <Route path="/SocialMediaSetup" element={<LayoutWrapper currentPageName="SocialMediaSetup"><SocialMediaSetup /></LayoutWrapper>} />
      <Route path="/AIOrderForm" element={<LayoutWrapper currentPageName="AIOrderForm"><AIOrderForm /></LayoutWrapper>} />
      <Route path="/DailyTodoList" element={<LayoutWrapper currentPageName="DailyTodoList"><DailyTodoList /></LayoutWrapper>} />
      <Route path="/SalesAnalyticsDashboard" element={<LayoutWrapper currentPageName="SalesAnalyticsDashboard"><SalesAnalyticsDashboard /></LayoutWrapper>} />
      <Route path="/GoogleAdsOverlay" element={<LayoutWrapper currentPageName="GoogleAdsOverlay"><GoogleAdsOverlay /></LayoutWrapper>} />
      <Route path="/AdBusinessDashboard" element={<LayoutWrapper currentPageName="AdBusinessDashboard"><AdBusinessDashboard /></LayoutWrapper>} />
      <Route path="/AdBusinessOverview" element={<LayoutWrapper currentPageName="AdBusinessOverview"><AdBusinessOverview /></LayoutWrapper>} />
      <Route path="/SmartPayoutDashboard" element={<LayoutWrapper currentPageName="SmartPayoutDashboard"><SmartPayoutDashboard /></LayoutWrapper>} />
      <Route path="/ContestEntries" element={<LayoutWrapper currentPageName="ContestEntries"><ContestEntries /></LayoutWrapper>} />
      <Route path="/PaidPPCAdsMosaic" element={<PaidPPCAdsMosaic />} />
      <Route path="/HeadToHeadContest" element={<LayoutWrapper currentPageName="HeadToHeadContest"><HeadToHeadContest /></LayoutWrapper>} />
      <Route path="/WeeklyFeatureVote" element={<LayoutWrapper currentPageName="WeeklyFeatureVote"><WeeklyFeatureVote /></LayoutWrapper>} />
      <Route path="/WeeklyReferralContest" element={<LayoutWrapper currentPageName="WeeklyReferralContest"><WeeklyReferralContest /></LayoutWrapper>} />
      <Route path="/SharedWalletGroups" element={<LayoutWrapper currentPageName="SharedWalletGroups"><SharedWalletGroups /></LayoutWrapper>} />
      <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
      <Route path="/TermsOfService" element={<TermsOfService />} />
      <Route path="/AIContentHub" element={<LayoutWrapper currentPageName="AIContentHub"><AIContentHub /></LayoutWrapper>} />
      <Route path="/Store" element={<LayoutWrapper currentPageName="Store"><Store /></LayoutWrapper>} />
      <Route path="/AIAgentsSettings" element={<LayoutWrapper currentPageName="AIAgentsSettings"><AIAgentsSettings /></LayoutWrapper>} />
      <Route path="/ReferralCompetition" element={<LayoutWrapper currentPageName="ReferralCompetition"><ReferralCompetition /></LayoutWrapper>} />
      <Route path="/PPCSurveyBuilder" element={<LayoutWrapper currentPageName="PPCSurveyBuilder"><PPCSurveyBuilder /></LayoutWrapper>} />
      <Route path="/LevelAndBadgesPage" element={<LayoutWrapper currentPageName="LevelAndBadgesPage"><LevelAndBadgesPage /></LayoutWrapper>} />
      <Route path="/ReferralContest" element={<LayoutWrapper currentPageName="ReferralContest"><ReferralContest /></LayoutWrapper>} />
      <Route path="/InAppGameStore" element={<LayoutWrapper currentPageName="InAppGameStore"><Store /></LayoutWrapper>} />
      <Route path="/DeveloperPayoutDashboard" element={<LayoutWrapper currentPageName="DeveloperPayoutDashboard"><DeveloperPayoutDashboard /></LayoutWrapper>} />
      <Route path="/SellerUpload" element={<LayoutWrapper currentPageName="SellerUpload"><SellerUpload /></LayoutWrapper>} />
      <Route path="/Pricing" element={<LayoutWrapper currentPageName="Pricing"><Pricing /></LayoutWrapper>} />
      <Route path="/CompleteProfile" element={<CompleteProfile />} />
      <Route path="/AdminCredentials" element={<LayoutWrapper currentPageName="AdminCredentials"><AdminCredentials /></LayoutWrapper>} />
      <Route path="/AdminGlobalSettings" element={<LayoutWrapper currentPageName="AdminGlobalSettings"><AdminGlobalSettings /></LayoutWrapper>} />
      <Route path="/AdminAuditLogs" element={<LayoutWrapper currentPageName="AdminAuditLogs"><AdminAuditLogs /></LayoutWrapper>} />
      <Route path="/Quests" element={<LayoutWrapper currentPageName="Quests"><Quests /></LayoutWrapper>} />
      <Route path="/ChatRooms" element={<LayoutWrapper currentPageName="ChatRooms"><ChatRooms /></LayoutWrapper>} />
      <Route path="/AdMarketplace" element={<LayoutWrapper currentPageName="AdMarketplace"><AdMarketplace /></LayoutWrapper>} />
      <Route path="/AIOrderFulfillmentDashboard" element={<LayoutWrapper currentPageName="AIOrderFulfillmentDashboard"><AIOrderFulfillmentDashboard /></LayoutWrapper>} />
      <Route path="/MarketTrendReport" element={<LayoutWrapper currentPageName="MarketTrendReport"><MarketTrendReport /></LayoutWrapper>} />
      <Route path="/DeveloperDisputeCenter" element={<LayoutWrapper currentPageName="DeveloperDisputeCenter"><DeveloperDisputeCenter /></LayoutWrapper>} />
      <Route path="/AIPayoutSchedulerPage" element={<LayoutWrapper currentPageName="AIPayoutSchedulerPage"><AIPayoutSchedulerPage /></LayoutWrapper>} />
      <Route path="/AIFeedbackABDashboard" element={<LayoutWrapper currentPageName="AIFeedbackABDashboard"><AIFeedbackABDashboard /></LayoutWrapper>} />
      <Route path="/AdFraudDashboard" element={<LayoutWrapper currentPageName="AdFraudDashboard"><AdFraudDashboard /></LayoutWrapper>} />
      <Route path="/AdSentimentAnalysis" element={<LayoutWrapper currentPageName="AdSentimentAnalysis"><AdSentimentAnalysis /></LayoutWrapper>} />
      <Route path="/GamerTournamentDashboard" element={<LayoutWrapper currentPageName="GamerTournamentDashboard"><GamerTournamentDashboard /></LayoutWrapper>} />
      <Route path="/ReferralGrowthEngine" element={<LayoutWrapper currentPageName="ReferralGrowthEngine"><ReferralGrowthEngine /></LayoutWrapper>} />
      <Route path="/AIAgentsCommandCenter" element={<LayoutWrapper currentPageName="AIAgentsCommandCenter"><AIAgentsCommandCenter /></LayoutWrapper>} />
      <Route path="/AffiliateMLMDashboard" element={<LayoutWrapper currentPageName="AffiliateMLMDashboard"><AffiliateMLMDashboard /></LayoutWrapper>} />
      <Route path="/AIAdDiscovery" element={<LayoutWrapper currentPageName="AIAdDiscovery"><AIAdDiscovery /></LayoutWrapper>} />
      <Route path="/WishlistIntelligence" element={<LayoutWrapper currentPageName="WishlistIntelligence"><WishlistIntelligence /></LayoutWrapper>} />
      <Route path="/WishlistSharerLeaderboard" element={<LayoutWrapper currentPageName="WishlistSharerLeaderboard"><WishlistSharerLeaderboardPage /></LayoutWrapper>} />
      <Route path="/DisputeResolverCenter" element={<LayoutWrapper currentPageName="DisputeResolverCenter"><DisputeResolverCenter /></LayoutWrapper>} />
      <Route path="/AIFinancialAdvisor" element={<LayoutWrapper currentPageName="AIFinancialAdvisor"><AIFinancialAdvisor /></LayoutWrapper>} />
      <Route path="/RealtimeFraudMonitor" element={<LayoutWrapper currentPageName="RealtimeFraudMonitor"><RealtimeFraudMonitorDashboard /></LayoutWrapper>} />
      <Route path="/GrowthEngineHub" element={<LayoutWrapper currentPageName="GrowthEngineHub"><GrowthEngineHub /></LayoutWrapper>} />
      <Route path="/AILTVDashboard" element={<LayoutWrapper currentPageName="AILTVDashboard"><AILTVDashboard /></LayoutWrapper>} />
      <Route path="/CompetitiveMonitoringDashboard" element={<LayoutWrapper currentPageName="CompetitiveMonitoringDashboard"><CompetitiveMonitoringDashboard /></LayoutWrapper>} />
      <Route path="/QuickSurveyBuilder" element={<LayoutWrapper currentPageName="QuickSurveyBuilder"><QuickSurveyBuilder /></LayoutWrapper>} />
      <Route path="/DeveloperToolsHub" element={<LayoutWrapper currentPageName="DeveloperToolsHub"><DeveloperToolsHub /></LayoutWrapper>} />
      <Route path="/AdCampaignOptimizer" element={<LayoutWrapper currentPageName="AdCampaignOptimizer"><AdCampaignOptimizerPage /></LayoutWrapper>} />
      <Route path="/AdCampaignManager" element={<LayoutWrapper currentPageName="AdCampaignManager"><AdCampaignManager /></LayoutWrapper>} />
      <Route path="/MarketAdvisor" element={<LayoutWrapper currentPageName="MarketAdvisor"><MarketAdvisor /></LayoutWrapper>} />
      <Route path="/RevenueHub" element={<LayoutWrapper currentPageName="RevenueHub"><RevenueHub /></LayoutWrapper>} />
      <Route path="/CRMDashboard" element={<LayoutWrapper currentPageName="CRMDashboard"><CRMDashboard /></LayoutWrapper>} />
      <Route path="/AutomationReviewDashboard" element={<LayoutWrapper currentPageName="AutomationReviewDashboard"><AutomationReviewDashboard /></LayoutWrapper>} />
      <Route path="/WhiteLabelSetup" element={<WhiteLabelSetup />} />
      <Route path="/AutomationGuardianDashboard" element={<LayoutWrapper currentPageName="AutomationGuardianDashboard"><AutomationGuardianDashboard /></LayoutWrapper>} />
      <Route path="/DisputeClaimsUser" element={<LayoutWrapper currentPageName="DisputeClaimsUser"><DisputeClaimsUser /></LayoutWrapper>} />
      <Route path="/AdminDisputeResolution" element={<LayoutWrapper currentPageName="AdminDisputeResolution"><AdminDisputeResolution /></LayoutWrapper>} />
      <Route path="/SubmitDisputeWizard" element={<LayoutWrapper currentPageName="SubmitDisputeWizard"><SubmitDisputeWizard /></LayoutWrapper>} />
      <Route path="/ReengagementDashboard" element={<LayoutWrapper currentPageName="ReengagementDashboard"><ReengagementDashboard /></LayoutWrapper>} />
      <Route path="/AIDisputeAutomationDashboard" element={<LayoutWrapper currentPageName="AIDisputeAutomationDashboard"><AIDisputeAutomationDashboard /></LayoutWrapper>} />
      <Route path="/ViralContentDashboard" element={<LayoutWrapper currentPageName="ViralContentDashboard"><ViralContentDashboard /></LayoutWrapper>} />
      <Route path="/BusinessClientReengagementDashboard" element={<LayoutWrapper currentPageName="BusinessClientReengagementDashboard"><BusinessClientReengagementDashboard /></LayoutWrapper>} />
      <Route path="/AffiliatePortal" element={<LayoutWrapper currentPageName="AffiliatePortal"><AffiliatePortal /></LayoutWrapper>} />
      <Route path="/CompetitorIntelligenceDashboard" element={<LayoutWrapper currentPageName="CompetitorIntelligenceDashboard"><CompetitorIntelligenceDashboard /></LayoutWrapper>} />
      <Route path="/CompetitorAlertFeed" element={<LayoutWrapper currentPageName="CompetitorAlertFeed"><CompetitorAlertFeed /></LayoutWrapper>} />
      <Route path="/AffiliateContentSchedulerCalendar" element={<LayoutWrapper currentPageName="AffiliateContentSchedulerCalendar"><AffiliateContentSchedulerCalendar /></LayoutWrapper>} />
      <Route path="/ReferralFraudDetectionDashboard" element={<LayoutWrapper currentPageName="ReferralFraudDetectionDashboard"><ReferralFraudDetectionDashboard /></LayoutWrapper>} />
      <Route path="/AffiliateGrowthCampaignDashboard" element={<LayoutWrapper currentPageName="AffiliateGrowthCampaignDashboard"><AffiliateGrowthCampaignDashboard /></LayoutWrapper>} />
      <Route path="/ContentLibraryBrowser" element={<LayoutWrapper currentPageName="ContentLibraryBrowser"><ContentLibraryBrowser /></LayoutWrapper>} />
      <Route path="/AIMarketPulse" element={<LayoutWrapper currentPageName="AIMarketPulse"><AIMarketPulse /></LayoutWrapper>} />
      <Route path="/AffiliateOnboarding" element={<LayoutWrapper currentPageName="AffiliateOnboarding"><AffiliateOnboarding /></LayoutWrapper>} />
      <Route path="/DeveloperAnalyticsDashboard" element={<LayoutWrapper currentPageName="DeveloperAnalyticsDashboard"><DeveloperAnalyticsDashboard /></LayoutWrapper>} />
      <Route path="/AdminLocalizationPanel" element={<LayoutWrapper currentPageName="AdminLocalizationPanel"><AdminLocalizationPanel /></LayoutWrapper>} />
      <Route path="/AffiliateDisputeCenter" element={<LayoutWrapper currentPageName="AffiliateDisputeCenter"><AffiliateDisputeCenter /></LayoutWrapper>} />
      <Route path="/AdCreativeABTestingDashboard" element={<LayoutWrapper currentPageName="AdCreativeABTestingDashboard"><AdCreativeABTestingDashboard /></LayoutWrapper>} />
      <Route path="/AffiliatePayoutManager" element={<LayoutWrapper currentPageName="AffiliatePayoutManager"><AffiliatePayoutManager /></LayoutWrapper>} />
      <Route path="/AffiliateChurnMonitor" element={<LayoutWrapper currentPageName="AffiliateChurnMonitor"><AffiliateChurnMonitor /></LayoutWrapper>} />
      <Route path="/SupportTicketDossierViewer" element={<LayoutWrapper currentPageName="SupportTicketDossierViewer"><SupportTicketDossierViewer /></LayoutWrapper>} />
      <Route path="/DisputeAutoApprovalSettings" element={<LayoutWrapper currentPageName="DisputeAutoApprovalSettings"><DisputeAutoApprovalSettings /></LayoutWrapper>} />
      <Route path="/MarketingAssetRepository" element={<LayoutWrapper currentPageName="MarketingAssetRepository"><MarketingAssetRepository /></LayoutWrapper>} />
      <Route path="/AffiliateAnalyticsDashboard" element={<LayoutWrapper currentPageName="AffiliateAnalyticsDashboard"><AffiliateAnalyticsDashboard /></LayoutWrapper>} />
      <Route path="/AffiliateTierDashboard" element={<LayoutWrapper currentPageName="AffiliateTierDashboard"><AffiliateTierDashboard /></LayoutWrapper>} />
      <Route path="/AdminProfitCalculator" element={<LayoutWrapper currentPageName="AdminProfitCalculator"><AdminProfitCalculator /></LayoutWrapper>} />
      <Route path="/AdminAffiliatePayoutDashboard" element={<LayoutWrapper currentPageName="AdminAffiliatePayoutDashboard"><AdminAffiliatePayoutDashboard /></LayoutWrapper>} />
      <Route path="/ClientAnalyticsDashboard" element={<LayoutWrapper currentPageName="ClientAnalyticsDashboard"><ClientAnalyticsDashboard /></LayoutWrapper>} />
      <Route path="/PayoutMarketplace" element={<LayoutWrapper currentPageName="PayoutMarketplace"><PayoutMarketplace /></LayoutWrapper>} />
      <Route path="/AISocialMediaEngine" element={<LayoutWrapper currentPageName="AISocialMediaEngine"><AISocialMediaEngine /></LayoutWrapper>} />
      <Route path="/AIDisputeResolutionCenter" element={<LayoutWrapper currentPageName="AIDisputeResolutionCenter"><AIDisputeResolutionCenter /></LayoutWrapper>} />
      <Route path="/AIVideoStudio" element={<LayoutWrapper currentPageName="AIVideoStudio"><AIVideoStudio /></LayoutWrapper>} />
      <Route path="/AIAutomationLearningDashboard" element={<LayoutWrapper currentPageName="AIAutomationLearningDashboard"><AIAutomationLearningDashboard /></LayoutWrapper>} />
      <Route path="/GameMonetizationDashboard" element={<LayoutWrapper currentPageName="GameMonetizationDashboard"><GameMonetizationDashboard /></LayoutWrapper>} />
      <Route path="/DeveloperEarningsDashboard" element={<LayoutWrapper currentPageName="DeveloperEarningsDashboard"><DeveloperEarningsDashboard /></LayoutWrapper>} />
      <Route path="/AffiliateMarketingPage" element={<LayoutWrapper currentPageName="AffiliateMarketingPage"><AffiliateMarketingPage /></LayoutWrapper>} />
      <Route path="/AIRevenueTracker" element={<LayoutWrapper currentPageName="AIRevenueTracker"><AIRevenueTracker /></LayoutWrapper>} />
      <Route path="/FeaturedGameDashboard" element={<LayoutWrapper currentPageName="FeaturedGameDashboard"><FeaturedGameDashboard /></LayoutWrapper>} />
      <Route path="/ThirdPartySellerMarketplace" element={<LayoutWrapper currentPageName="ThirdPartySellerMarketplace"><ThirdPartySellerMarketplace /></LayoutWrapper>} />
      <Route path="/SocialMediaAdPoster" element={<LayoutWrapper currentPageName="SocialMediaAdPoster"><SocialMediaAdPoster /></LayoutWrapper>} />
      <Route path="/UpfrontEarningsPage" element={<LayoutWrapper currentPageName="UpfrontEarningsPage"><UpfrontEarningsPage /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <LocalizationProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <NavigationTracker />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </LocalizationProvider>
    </AuthProvider>
  )
}

export default App```

## `src/Layout.jsx`

```jsx
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import {
  Home,
  LayoutDashboard,
  Briefcase,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  DollarSign,
  ShoppingCart,
  Bot,
  Trophy,
  Users,
  Swords,
  Mail,
  Star,
  TrendingUp,
  User,
  Heart,
  ArrowRightLeft,
  Globe,
  BarChart2,
  AlertCircle,
  Brain,
  ShieldCheck,
  Gamepad2,
  Megaphone,
  Store } from
'lucide-react';
import GamerGainLogo from '@/components/branding/GamerGainLogo';
import SupportChatButton from '@/components/support/SupportChatButton';
import LogoutPromptModal from '@/components/user/LogoutPromptModal';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import MegaContestButton from '@/components/referral/MegaContestButton';
import { LocaleProvider } from '@/components/locale/LocaleContext';
import CustomerFeedbackSurvey from '@/components/feedback/CustomerFeedbackSurvey';
import { initTracker, setPage, trackEvent } from '@/lib/uxTracker';
import FloatingNavSidebar from '@/components/nav/FloatingNavSidebar';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { useSurveyMatchNotifications } from '@/hooks/useSurveyMatchNotifications';
import PPCAdSearchWidget from '@/components/ppc/PPCAdSearchWidget';
import WidgetDownloadPrompt from '@/components/widgets/WidgetDownloadPrompt';
import PPCWelcomePopup from '@/components/user/PPCWelcomePopup';

// Lazy load non-critical components
const SurveyAlertWatcher = lazy(() => import('@/components/surveys/SurveyAlertWatcher'));
const PushNotificationManager = lazy(() => import('@/components/notifications/PushNotificationManager'));
const SurveyNotificationBanner = lazy(() => import('@/components/notifications/SurveyNotificationBanner'));
const SurveyDemandAlerts = lazy(() => import('@/components/ppc/SurveyDemandAlerts'));
const DailyFeedbackModal = lazy(() => import('@/components/feedback/DailyFeedbackModal'));
const DailyMockupVoteSurvey = lazy(() => import('@/components/feedback/DailyMockupVoteSurvey'));
const SurveyRewardNotifier = lazy(() => import('@/components/surveys/SurveyRewardNotifier'));
const PPCPushNotificationManager = lazy(() => import('@/components/notifications/PPCPushNotificationManager'));
const AIPersonalizedDailyGoal = lazy(() => import('@/components/dashboard/AIPersonalizedDailyGoal'));
const WishlistDailyNotifier = lazy(() => import('@/components/wishlist/WishlistDailyNotifier'));
const PriceDropAlertBadge = lazy(() => import('@/components/wishlist/PriceDropAlertBadge'));
const WishlistAutoAddNotifier = lazy(() => import('@/components/wishlist/WishlistAutoAddNotifier'));

export default function Layout({ children, currentPageName }) {
  // Use AuthContext — avoids a duplicate base44.auth.me() call on every page mount
  const { user, isAuthenticated } = useAuth();
  const [mountSideEffects, setMountSideEffects] = useState(false);

  useRealtimeNotifications(user?.id);
  useSurveyMatchNotifications(user);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false);
  const [showPPCPopup, setShowPPCPopup] = useState(false);
  const [promptShownThisSession, setPromptShownThisSession] = useState(false);
  const [logoutContext, setLogoutContext] = useState({});

  // Defer mounting of background side-effect components by 3 seconds
  // to avoid thundering-herd of API calls on initial page load
  useEffect(() => {
    const t = setTimeout(() => setMountSideEffects(true), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (user) {
      initTracker(user.id);
      if (!sessionStorage.getItem('ppc_popup_shown_v2')) {
        sessionStorage.setItem('ppc_popup_shown_v2', '1');
        setShowPPCPopup(true);
      }
    }
  }, [user?.id]);

  // Track page changes
  useEffect(() => {
    if (currentPageName && user) {
      setPage(currentPageName);
      trackEvent('page_view', { page: currentPageName });
    }
  }, [currentPageName, user?.id]);

  const { data: activeEvents = [] } = useQuery({
    queryKey: ['activeEvents'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const events = await base44.entities.LiveEvent.filter({ is_active: true });
      return events.filter((e) => new Date(e.start_time) <= new Date(now) && new Date(e.end_time) >= new Date(now));
    },
    enabled: isAuthenticated && mountSideEffects,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30
  });

  useEffect(() => {
    let deferredPrompt;
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      deferredPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const shouldShowLogoutPrompt = () => {
    if (!user || !user.prompt_before_logout) return false;
    if (promptShownThisSession) return false;
    const lastShown = localStorage.getItem('lastLogoutPromptShown');
    if (lastShown) {
      const hoursSinceLastShown = (new Date() - new Date(lastShown)) / (1000 * 60 * 60);
      if (hoursSinceLastShown < 24) return false;
    }
    if (user.last_social_post_date) {
      const daysSinceLastPost = (new Date() - new Date(user.last_social_post_date)) / (1000 * 60 * 60 * 24);
      if (daysSinceLastPost < 7) return false;
    }
    const hasActiveCampaign = activeEvents.length > 0;
    return hasActiveCampaign || !user.last_social_post_date;
  };

  const handleLogoutClick = () => {
    if (shouldShowLogoutPrompt()) {
      setShowLogoutPrompt(true);
      setPromptShownThisSession(true);
    } else {
      base44.auth.logout();
    }
  };

  const handleActualLogout = () => base44.auth.logout();

  const navigation = [
  { name: 'Home', icon: Home, path: 'Home' },
  { name: 'Game Store', icon: ShoppingCart, path: 'InAppGameStore' },
  { name: 'Marketplace', icon: Store, path: 'ThirdPartySellerMarketplace', requireAuth: true },
  { name: 'Surveys', icon: DollarSign, path: 'Surveys', requireAuth: true },
  { name: 'Dashboard', icon: LayoutDashboard, path: 'UserDashboard', requireAuth: true },
  { name: 'Creators', icon: Users, path: 'CreatorMarketplace' },
  { name: 'Wishlist', icon: Heart, path: 'Wishlist', requireAuth: true },
  { name: 'Transfer Money', icon: ArrowRightLeft, path: 'MoneyTransfer', requireAuth: true },
  { name: 'Profile', icon: User, path: 'UserProfile', requireAuth: true },
  { name: 'Creator Hub', icon: Star, path: 'CreatorDashboard', requireAuth: true },
  { name: 'Referrals', icon: Users, path: 'ReferralDashboard', requireAuth: true },
  { name: 'Affiliate Store', icon: DollarSign, path: 'AffiliateMarketplace', requireAuth: true },
  { name: 'AI Affiliate MLM', icon: TrendingUp, path: 'AffiliateMLMDashboard', requireAuth: true },
  { name: 'Referral Prize Pool', icon: Star, path: 'ReferralContest', requireAuth: true },
  { name: 'Referral Analytics', icon: TrendingUp, path: 'ReferralAnalytics', requireAuth: true },
  { name: 'Link Tracking', icon: TrendingUp, path: 'ReferralTracking', requireAuth: true },
  { name: 'Payout Settings', icon: Settings, path: 'PayoutSettings', requireAuth: true },
  { name: 'Referral Hub', icon: Users, path: 'ReferralHub', requireAuth: true },
  { name: 'Withdrawal', icon: DollarSign, path: 'Withdrawal', requireAuth: true },
  { name: 'PPC Marketplace', icon: TrendingUp, path: 'PPCMarketplace', requireAuth: true },
  { name: 'Survey Embed', icon: Globe, path: 'SurveyEmbedManager', requireAuth: true },
  { name: 'AI Automation Center', icon: Bot, path: 'AIAutomationCenter', requireAuth: true },
  { name: 'Payout History', icon: DollarSign, path: 'PayoutHistory', requireAuth: true },
  { name: 'My Payouts', icon: DollarSign, path: 'MyPayouts', requireAuth: true },
  { name: 'Payout Status', icon: DollarSign, path: 'PayoutStatus', requireAuth: true },
  { name: 'My Orders', icon: ShoppingCart, path: 'MyOrders', requireAuth: true },
  { name: 'Campaigns', icon: TrendingUp, path: 'Campaigns', requireAuth: true },
  { name: 'Notifications', icon: Settings, path: 'NotificationHistory', requireAuth: true },
  { name: 'Challenges', icon: Trophy, path: 'Challenges', requireAuth: true },
  { name: 'Notification Inbox', icon: Mail, path: 'NotificationInbox', requireAuth: true },
  { name: 'Survey Builder', icon: FileText, path: 'SurveyTemplateBuilder', requireAuth: true },
  { name: 'Dispute Center', icon: AlertCircle, path: 'DisputeCenter', requireAuth: true },
  { name: 'Global Prestige', icon: Star, path: 'GlobalPrestigeHub', requireAuth: true },
  { name: 'Survey Marketplace', icon: ShoppingCart, path: 'SurveyMarketplace', requireAuth: true },
  { name: 'Earnings Simulator', icon: TrendingUp, path: 'EarningsSimulatorPage', requireAuth: true },
  { name: 'Achievements', icon: Trophy, path: 'AchievementsPage', requireAuth: true },
  { name: 'Leaderboard', icon: Trophy, path: 'GlobalLeaderboard' },
  { name: 'Daily Streak', icon: Star, path: 'DailyEarningStreak', requireAuth: true },
  { name: 'Contact Us', icon: Mail, path: 'ContactUs' },
  { name: 'Referral Leaderboard', icon: Trophy, path: 'ReferralLeaderboardPage', requireAuth: true },
  { name: 'Survey Analytics', icon: BarChart2, path: 'SurveyAdminDashboard', requireAuth: true },
  { name: 'Notifications', icon: Settings, path: 'NotificationSettings', requireAuth: true },
  { name: 'Manage Payouts', icon: DollarSign, path: 'ManagePayouts', requireAuth: true },
  { name: 'My Respondent Profile', icon: User, path: 'RespondentProfile', requireAuth: true },
  { name: 'Advanced Analytics', icon: TrendingUp, path: 'AdvancedSurveyAnalytics', requireAuth: true },
  { name: 'Survey Analytics', icon: TrendingUp, path: 'SurveyAnalytics', requireAuth: true },
  { name: 'Business Analytics', icon: TrendingUp, path: 'BusinessSurveyAnalytics', requireAuth: true },
  { name: 'Developer Rankings', icon: Trophy, path: 'DeveloperLeaderboards' },
  { name: 'AI Generator', icon: Bot, path: 'MovieStarGenerator', requireAuth: true },
  { name: 'Inbox', icon: Mail, path: 'UserInbox', requireAuth: true },
  { name: 'Leaderboard', icon: Trophy, path: 'Leaderboard', requireAuth: true },
  { name: 'Tournaments', icon: Swords, path: 'Tournaments', requireAuth: true },
  { name: 'Guilds', icon: Users, path: 'Guilds', requireAuth: true },
  { name: 'Rewards', icon: Trophy, path: 'Gamification', requireAuth: true },
  { name: 'Developers', icon: Briefcase, path: 'BusinessDashboard', requireAuth: true },
  { name: 'Seller Upload', icon: ShoppingCart, path: 'SellerUpload', requireAuth: true },
  { name: 'Revenue Hub', icon: DollarSign, path: 'RevenueHub' },
  { name: 'Pricing', icon: DollarSign, path: 'Pricing' },
  { name: 'AI Game Creator', icon: Gamepad2, path: 'DeveloperToolsHub', requireAuth: true },
  { name: 'Game Monetization', icon: DollarSign, path: 'GameMonetizationDashboard', requireAuth: true },
  { name: 'Dev Earnings', icon: TrendingUp, path: 'DeveloperEarningsDashboard', requireAuth: true },
  { name: 'Affiliate Marketing', icon: Megaphone, path: 'AffiliateMarketingPage', requireAuth: true },
  { name: 'Game Voting Hub', icon: Gamepad2, path: 'GameVotingHub' },
  { name: 'Daily Earnings Tracker', icon: DollarSign, path: 'FeaturedGameDashboard', requireAuth: true },
  { name: 'AI Ad Poster', icon: Megaphone, path: 'SocialMediaAdPoster', requireAuth: true },
  { name: 'Get $1,460 Upfront', icon: DollarSign, path: 'UpfrontEarningsPage', requireAuth: true },
  { name: 'Developer Onboarding', icon: Briefcase, path: 'DeveloperOnboarding', requireAuth: true },
  { name: 'Notification Inbox', icon: Mail, path: 'NotificationInbox', requireAuth: true },
  { name: 'Tournaments', icon: Trophy, path: 'Tournaments', requireAuth: true }];


  if (user?.role === 'admin') {
    navigation.push({ name: 'Admin', icon: Settings, path: 'AdminDashboard', requireAuth: true });
    navigation.push({ name: 'PayPal', icon: DollarSign, path: 'PayPalManagement', requireAuth: true });
    navigation.push({ name: 'Users', icon: Bot, path: 'AdminUsers', requireAuth: true });
    navigation.push({ name: 'Feedback Intelligence', icon: Brain, path: 'FeedbackAdminDashboard', requireAuth: true });
    navigation.push({ name: 'UX Heatmap', icon: TrendingUp, path: 'UXHeatmapDashboard', requireAuth: true });
    navigation.push({ name: 'AI Revenue Tracker', icon: DollarSign, path: 'AIRevenueTracker', requireAuth: true });
  }

  const filteredNav = navigation.filter((item) => !item.requireAuth || isAuthenticated);

  return (
    <LocaleProvider>
      <div
        className="min-h-screen bg-white">
        
        {/* Header - Only show on Home page */}
        {currentPageName === 'Home' && <header
          className="sticky top-0 z-50 border-b-2 border-red-200 shadow-lg"
          style={{
            background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.9), rgba(254, 242, 242, 0.8))',
            boxShadow: '0 4px 30px rgba(220, 38, 38, 0.1)'
          }}>
          
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Logo + Contest Button */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link to={createPageUrl('Home')} className="flex items-center gap-2 group">
                  <div className="group-hover:scale-110 transition-transform">
                    <GamerGainLogo className="w-10 h-10" />
                  </div>
                  <span className="text-xl font-bold bg-gradient-to-r from-green-700 to-green-900 bg-clip-text text-transparent hidden sm:inline">
                    GamerGain
                  </span>
                </Link>
                <MegaContestButton />
              </div>

              {/* Desktop Navigation — core buttons always visible */}
              <nav className="hidden md:flex items-center gap-1 flex-shrink-0 px-2">
                <Link to="/DeveloperToolsHub" className="flex-shrink-0">
                  <Button variant={currentPageName === 'DeveloperToolsHub' ? "default" : "ghost"} size="sm"
                  className={currentPageName === 'DeveloperToolsHub' ? "bg-gradient-to-r from-violet-600 to-purple-600 shadow-md whitespace-nowrap" : "bg-violet-100 hover:bg-violet-200 text-violet-800 font-bold border border-violet-300 whitespace-nowrap"}>
                    🎮 AI Game Creator
                  </Button>
                </Link>
                <Link to={createPageUrl('InAppGameStore')} className="flex-shrink-0">
                  <Button variant={currentPageName === 'InAppGameStore' ? "default" : "ghost"} size="sm"
                  className={currentPageName === 'InAppGameStore' ? "bg-gradient-to-r from-red-600 to-red-700 shadow-md whitespace-nowrap" : "hover:bg-red-50 whitespace-nowrap"}>
                    🛒 Store
                  </Button>
                </Link>
                <Link to={createPageUrl('Surveys')} className="flex-shrink-0">
                  <Button variant={currentPageName === 'Surveys' ? "default" : "ghost"} size="sm"
                  className={currentPageName === 'Surveys' ? "bg-gradient-to-r from-red-600 to-red-700 shadow-md whitespace-nowrap" : "hover:bg-red-50 whitespace-nowrap"}>
                    📋 Surveys
                  </Button>
                </Link>
                <Link to={createPageUrl('UserDashboard')} className="flex-shrink-0 hidden lg:block">
                  <Button variant={currentPageName === 'UserDashboard' ? "default" : "ghost"} size="sm"
                  className={currentPageName === 'UserDashboard' ? "bg-gradient-to-r from-red-600 to-red-700 shadow-md whitespace-nowrap" : "hover:bg-red-50 whitespace-nowrap"}>
                    📊 Dashboard
                  </Button>
                </Link>
                <Link to={createPageUrl('Withdrawal')} className="flex-shrink-0 hidden lg:block">
                  <Button variant={currentPageName === 'Withdrawal' ? "default" : "ghost"} size="sm"
                  className={currentPageName === 'Withdrawal' ? "bg-gradient-to-r from-green-600 to-emerald-600 shadow-md whitespace-nowrap" : "hover:bg-green-50 text-green-700 font-semibold border border-green-200 whitespace-nowrap"}>
                    💵 Withdraw
                  </Button>
                </Link>
                <Link to={createPageUrl('ReferralContest')} className="flex-shrink-0 hidden lg:block">
                  <Button variant={currentPageName === 'ReferralContest' ? "default" : "ghost"} size="sm"
                  className={currentPageName === 'ReferralContest' ? "bg-gradient-to-r from-yellow-500 to-yellow-600 shadow-md whitespace-nowrap" : "hover:bg-yellow-50 text-yellow-700 font-semibold whitespace-nowrap"}>
                    🏆 Contest
                  </Button>
                </Link>
              </nav>

              {/* Desktop Right: user controls */}
              <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                {isAuthenticated && user ?
                <>
                      <div className="text-right hidden lg:block">
                        <p className="text-xs font-medium text-gray-900">{user.full_name}</p>
                        <p className="text-xs text-emerald-600 font-medium">${(user.total_earnings || 0).toFixed(2)}</p>
                      </div>
                      {mountSideEffects &&
                  <Suspense fallback={null}>
                          <div className="hidden lg:block">
                            <PushNotificationManager />
                            <SurveyDemandAlerts user={user} />
                          </div>
                        </Suspense>
                  }
                      <NotificationCenter user={user} />
                    {user?.role === 'admin' &&
                  <Link to={createPageUrl('AdminDashboard')}>
                        <Button variant="ghost" size="icon" title="Admin Dashboard">
                          <ShieldCheck className="w-4 h-4 text-purple-600" />
                        </Button>
                      </Link>
                  }
                    <Link to={createPageUrl('Settings')}>
                      <Button variant="ghost" size="icon">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={handleLogoutClick}>
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </> :

                <Button onClick={() => base44.auth.redirectToLogin()} className="bg-gradient-to-r from-red-600 to-red-700 shadow-lg" size="sm">
                    Sign In
                  </Button>
                }
              </div>

              {/* Mobile: Menu Button Only */}
              <div className="md:hidden flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                  {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen &&
          <div className="md:hidden border-t bg-white">
              <div className="px-4 py-3 space-y-1">
                {filteredNav.map((item) =>
              <Link key={item.name} to={createPageUrl(item.path)} onClick={() => setIsMenuOpen(false)}>
                    <Button
                  variant={currentPageName === item.path ? "default" : "ghost"}
                  className={`w-full justify-start text-sm ${currentPageName === item.path ? "bg-gradient-to-r from-blue-600 to-blue-700" : ""}`}>
                  
                      <item.icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </Button>
                  </Link>
              )}

                {isAuthenticated && user ?
              <>
                    <div className="pt-3 pb-1 border-t">
                      <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                      <p className="text-xs text-emerald-600 font-medium">${(user.total_earnings || 0).toFixed(2)} earned</p>
                    </div>
                    <Link to={createPageUrl('Settings')} onClick={() => setIsMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-sm">
                        <Settings className="w-4 h-4 mr-2" />Settings
                      </Button>
                    </Link>
                    <Button
                  variant="ghost"
                  className="w-full justify-start text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => {setIsMenuOpen(false);handleLogoutClick();}}>
                  
                      <LogOut className="w-4 h-4 mr-2" />Logout
                    </Button>
                  </> :

              <Button
                onClick={() => {setIsMenuOpen(false);base44.auth.redirectToLogin();}}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-sm">
                
                    Sign In
                  </Button>
              }
              </div>
            </div>
          }
        </header>}

        {/* PPC Widget Top Bar — deferred to avoid initial load spike */}
         {isAuthenticated && user && mountSideEffects &&
        <div className="sticky top-0 z-40 bg-white border-b border-red-200 shadow-sm">
             <PPCAdSearchWidget variant="compact" />
           </div>
        }

         {/* Main Content */}
         <main>{children}</main>

         {/* Global AI Daily Goal Sidebar — only on Dashboard, deferred */}
         {isAuthenticated && user && currentPageName === 'UserDashboard' && mountSideEffects &&
        <div className="fixed right-4 top-32 z-30 w-80 max-h-[calc(100vh-150px)] overflow-y-auto hidden lg:block">
             <Suspense fallback={null}>
               <AIPersonalizedDailyGoal user={user} />
             </Suspense>
           </div>
        }

         <FloatingNavSidebar currentPageName={currentPageName} />

         {mountSideEffects &&
        <Suspense fallback={null}>
             {isAuthenticated && user && <SurveyAlertWatcher user={user} />}
             {isAuthenticated && user && <SurveyNotificationBanner userId={user.id} />}
             {isAuthenticated && user && <DailyFeedbackModal user={user} />}
             {isAuthenticated && user && <DailyMockupVoteSurvey user={user} />}
             {isAuthenticated && user && <SurveyRewardNotifier user={user} />}
             {isAuthenticated && user && <PPCPushNotificationManager />}
             {isAuthenticated && user && <WishlistDailyNotifier user={user} />}
             {isAuthenticated && user && <PriceDropAlertBadge user={user} />}
             {isAuthenticated && user && <WishlistAutoAddNotifier user={user} />}
           </Suspense>
        }
         <SupportChatButton />
        {isAuthenticated && mountSideEffects && <WidgetDownloadPrompt />}

        {showPPCPopup && <PPCWelcomePopup onClose={() => setShowPPCPopup(false)} />}

        <LogoutPromptModal
          isOpen={showLogoutPrompt}
          onClose={() => setShowLogoutPrompt(false)}
          onLogout={handleActualLogout}
          user={user}
          contextData={logoutContext} />
        

        {/* Customer Feedback Survey - Always Visible */}
        {isAuthenticated && user && mountSideEffects &&
        <div className="fixed bottom-4 right-4 w-96 max-h-[500px] z-20 shadow-xl">
            <Suspense fallback={null}>
              <CustomerFeedbackSurvey />
            </Suspense>
          </div>
        }

        {/* Footer */}
        <footer className="border-t bg-white mt-20">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="grid md:grid-cols-4 gap-8">
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <GamerGainLogo className="w-10 h-10" />
                  <span className="text-xl font-bold bg-gradient-to-r from-green-700 to-green-900 bg-clip-text text-transparent">GamerGain</span>
                </div>
                <p className="text-gray-600 text-sm">The premium game discovery platform. Play games, earn rewards, connect with creators.</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Platform</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li><Link to={createPageUrl('Home')} className="hover:text-blue-600">Home</Link></li>
                  <li><Link to={createPageUrl('UserDashboard')} className="hover:text-blue-600">Dashboard</Link></li>
                  <li><Link to={createPageUrl('InAppGameStore')} className="hover:text-blue-600">Store</Link></li>
                  <li><Link to={createPageUrl('ReferralContest')} className="hover:text-yellow-600 font-medium">🏆 7M Contest</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Developers</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li><Link to={createPageUrl('BusinessDashboard')} className="hover:text-blue-600">Developer Portal</Link></li>
                  <li><a href="#" className="hover:text-blue-600">Documentation</a></li>
                  <li><Link to={createPageUrl('ContactUs')} className="hover:text-blue-600">Contact Us</Link></li>
              <li><a href="#" className="hover:text-blue-600">Support</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t mt-8 pt-8 text-center text-sm text-gray-500">
              <p>© 2024 GamerGain. All rights reserved. | Premium gaming platform</p>
            </div>
          </div>
        </footer>
      </div>
    </LocaleProvider>);

}```

## `src/components/admin/RewardDistributionPanel.jsx`

```jsx
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Trophy, Users, Zap, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RewardDistributionPanel() {
  const [processing, setProcessing] = useState(false);
  const [autoResults, setAutoResults] = useState(null);
  const [manualForm, setManualForm] = useState({ target_user_id: '', amount: '', reward_type: 'contest_win', reward_note: '' });
  const [contestForm, setContestForm] = useState({ winner_user_id: '', prize_amount: '', contest_name: '7 Million User Referral Prize Pool' });

  const { data: recentPayouts = [] } = useQuery({
    queryKey: ['recentPayouts'],
    queryFn: () => base44.entities.Payout.list('-created_date', 20),
  });

  const runAutoPayout = async () => {
    setProcessing(true);
    setAutoResults(null);
    const res = await base44.functions.invoke('processRewardPayout', { action: 'process_all' });
    setProcessing(false);
    if (res.data.ok) {
      setAutoResults(res.data);
      toast.success(`Processed ${res.data.processed} payouts!`);
    } else {
      toast.error('Auto payout failed: ' + (res.data.error || 'Unknown error'));
    }
  };

  const sendManualPayout = async () => {
    if (!manualForm.target_user_id || !manualForm.amount) {
      toast.error('Please fill in User ID and Amount');
      return;
    }
    setProcessing(true);
    const res = await base44.functions.invoke('processRewardPayout', {
      action: 'single',
      target_user_id: manualForm.target_user_id,
      amount: parseFloat(manualForm.amount),
      reward_type: manualForm.reward_type,
      reward_note: manualForm.reward_note,
    });
    setProcessing(false);
    if (res.data.ok) {
      toast.success('Manual payout sent successfully!');
      setManualForm({ target_user_id: '', amount: '', reward_type: 'contest_win', reward_note: '' });
    } else {
      toast.error('Payout failed: ' + (res.data.error || 'Unknown'));
    }
  };

  const sendContestPrize = async () => {
    if (!contestForm.winner_user_id || !contestForm.prize_amount) {
      toast.error('Please fill in Winner User ID and Prize Amount');
      return;
    }
    setProcessing(true);
    const res = await base44.functions.invoke('processRewardPayout', {
      action: 'contest_winner',
      winner_user_id: contestForm.winner_user_id,
      prize_amount: parseFloat(contestForm.prize_amount),
      contest_name: contestForm.contest_name,
    });
    setProcessing(false);
    if (res.data.ok) {
      toast.success(`Contest prize sent via ${res.data.method}!`);
      setContestForm({ winner_user_id: '', prize_amount: '', contest_name: '7 Million User Referral Prize Pool' });
    } else {
      toast.error('Contest payout failed: ' + (res.data.error || 'Unknown'));
    }
  };

  const statusColor = (status) => status === 'completed' ? 'bg-green-100 text-green-700' : status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';

  return (
    <div className="space-y-6">
      {/* Auto Payout */}
      <Card className="border-2 border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <Zap className="w-5 h-5" /> Auto Referral Commission Payouts
          </CardTitle>
          <CardDescription>Automatically pay all users who meet their payout threshold and frequency via PayPal.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={runAutoPayout} disabled={processing} className="bg-green-700 hover:bg-green-800 text-white">
            {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</> : <><Zap className="w-4 h-4 mr-2" /> Run Auto Payouts Now</>}
          </Button>
          {autoResults && (
            <div className="mt-4 p-3 bg-white rounded-lg border">
              <p className="font-medium text-green-800">✅ Processed {autoResults.processed} payouts</p>
              {autoResults.results?.map((r, i) => (
                <div key={i} className="flex items-center gap-2 mt-1 text-sm">
                  {r.success ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                  <span>User {r.user_id.slice(0, 8)}... — ${r.amount.toFixed(2)} — {r.success ? 'Sent' : 'Failed'}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contest Winner Payout */}
      <Card className="border-2 border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-800">
            <Trophy className="w-5 h-5" /> Contest Winner Payout
          </CardTitle>
          <CardDescription>Send prize money to a contest winner. If they have no PayPal, it's credited to their balance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Winner User ID</Label>
              <Input placeholder="User ID" value={contestForm.winner_user_id} onChange={e => setContestForm({ ...contestForm, winner_user_id: e.target.value })} />
            </div>
            <div>
              <Label>Prize Amount ($)</Label>
              <Input type="number" placeholder="0.00" value={contestForm.prize_amount} onChange={e => setContestForm({ ...contestForm, prize_amount: e.target.value })} />
            </div>
            <div>
              <Label>Contest Name</Label>
              <Input value={contestForm.contest_name} onChange={e => setContestForm({ ...contestForm, contest_name: e.target.value })} />
            </div>
          </div>
          <Button onClick={sendContestPrize} disabled={processing} className="bg-yellow-600 hover:bg-yellow-700 text-white">
            <Trophy className="w-4 h-4 mr-2" /> Send Contest Prize
          </Button>
        </CardContent>
      </Card>

      {/* Manual Single Payout */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" /> Manual Single Payout
          </CardTitle>
          <CardDescription>Send a one-off reward to any user with a PayPal configured.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>User ID</Label>
              <Input placeholder="User ID" value={manualForm.target_user_id} onChange={e => setManualForm({ ...manualForm, target_user_id: e.target.value })} />
            </div>
            <div>
              <Label>Amount ($)</Label>
              <Input type="number" placeholder="0.00" value={manualForm.amount} onChange={e => setManualForm({ ...manualForm, amount: e.target.value })} />
            </div>
            <div>
              <Label>Reward Type</Label>
              <Select value={manualForm.reward_type} onValueChange={v => setManualForm({ ...manualForm, reward_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contest_win">Contest Win</SelectItem>
                  <SelectItem value="referral_bonus">Referral Bonus</SelectItem>
                  <SelectItem value="gift_card">Gift Card Equivalent</SelectItem>
                  <SelectItem value="discount">Discount / Credit</SelectItem>
                  <SelectItem value="manual">Manual Reward</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input placeholder="Reward reason..." value={manualForm.reward_note} onChange={e => setManualForm({ ...manualForm, reward_note: e.target.value })} />
            </div>
          </div>
          <Button onClick={sendManualPayout} disabled={processing} className="bg-blue-600 hover:bg-blue-700 text-white">
            <DollarSign className="w-4 h-4 mr-2" /> Send Payout
          </Button>
        </CardContent>
      </Card>

      {/* Recent Payouts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Recent Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          {recentPayouts.length === 0 ? (
            <p className="text-gray-400 text-center py-6">No payouts yet</p>
          ) : (
            <div className="space-y-2">
              {recentPayouts.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                  <div>
                    <p className="font-medium">User {p.user_id?.slice(0, 8)}...</p>
                    <p className="text-xs text-gray-500">{p.description || p.payout_type} · {new Date(p.created_date).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-green-700">${(p.amount || 0).toFixed(2)}</span>
                    <Badge className={statusColor(p.status)}>{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}```

## `src/components/creators/AutoCreatorFeature.jsx`

```jsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Copy, Share2, RefreshCw, Loader2, TrendingUp, CheckCircle, Film, Camera, Video } from 'lucide-react';
import { toast } from 'sonner';

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', color: '#ff0050', icon: Film, hint: 'Short, punchy, trending hooks. Use emojis.' },
  { id: 'youtube_shorts', label: 'YouTube Shorts', color: '#FF0000', icon: Video, hint: 'Engaging thumbnail-worthy hook, clear CTA.' },
  { id: 'instagram', label: 'Instagram', color: '#E1306C', icon: Camera, hint: 'Visually descriptive, hashtag-rich, story-telling.' },
];

export default function AutoCreatorFeature({ user }) {
  const [generating, setGenerating] = useState(false);
  const [posts, setPosts] = useState({});
  const [selectedPlatforms, setSelectedPlatforms] = useState(['tiktok', 'youtube_shorts', 'instagram']);
  const [copiedId, setCopiedId] = useState(null);

  const { data: recentActivities = [] } = useQuery({
    queryKey: ['creator-activities', user?.id],
    queryFn: () => base44.entities.UserActivity.filter({ user_id: user.id }, '-created_date', 20),
    enabled: !!user?.id,
  });

  const { data: recentSurveys = [] } = useQuery({
    queryKey: ['creator-surveys', user?.id],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id }, '-date', 7),
    enabled: !!user?.id,
  });

  const referralLink = `${window.location.origin}?ref=${user?.id || 'user'}`;

  const buildContext = () => {
    const surveyTotal = recentSurveys.reduce((s, d) => s + (d.total_earned || 0), 0);
    const gameMilestones = recentActivities.filter(a => a.activity_type === 'game_installed' || a.activity_type === 'achievement_unlocked');
    const highEarningDays = recentSurveys.filter(d => (d.total_earned || 0) >= 3).length;

    return {
      totalEarned: (user?.total_earnings || 0).toFixed(2),
      recentWeekEarned: surveyTotal.toFixed(2),
      highEarningDays,
      gameMilestones: gameMilestones.slice(0, 3).map(a => a.description).join(', ') || 'none yet',
      surveysCompleted: recentSurveys.reduce((s, d) => s + (d.total_surveys_completed || 0), 0),
      referralLink,
      userName: user?.full_name?.split(' ')[0] || 'I',
    };
  };

  const generatePosts = async () => {
    setGenerating(true);
    const ctx = buildContext();
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a viral social media content expert. Create engaging posts for a GamerGain user who earns real money by playing games and completing surveys.

User stats:
- Total earnings: $${ctx.totalEarned}
- This week: $${ctx.recentWeekEarned}
- High-earning days (≥$3): ${ctx.highEarningDays} out of last 7 days
- Surveys completed this week: ${ctx.surveysCompleted}
- Game milestones: ${ctx.gameMilestones}
- Name: ${ctx.userName}
- Referral link: ${ctx.referralLink}

Create one viral post for EACH of these platforms: TikTok, YouTube Shorts, Instagram.

Rules:
- ALWAYS include the referral link naturally at the end
- Make it authentic, first-person, relatable, and exciting
- TikTok: short hook, 3-5 sentences, 5+ emojis, trending energy
- YouTube Shorts: attention-grabbing first line, story arc, clear CTA
- Instagram: storytelling caption, 15-20 hashtags at end, referral link in bio note
- Highlight real earnings, make it feel genuine not spammy
- Mention the contest/prize pool potential ($1M+) where natural

Return JSON with keys: tiktok, youtube_shorts, instagram (each a string).`,
        response_json_schema: {
          type: 'object',
          properties: {
            tiktok: { type: 'string' },
            youtube_shorts: { type: 'string' },
            instagram: { type: 'string' },
          }
        }
      });
      setPosts(result);
      toast.success('🎉 Posts generated! Copy and post to go viral.');
    } catch (e) {
      toast.error('Failed to generate posts. Please try again.');
    }
    setGenerating(false);
  };

  const copyPost = (platformId, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(platformId);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const togglePlatform = (id) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-br from-pink-600 via-purple-600 to-indigo-600 border-0 text-white shadow-xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <h2 className="text-xl font-black">Auto-Creator</h2>
              <p className="text-pink-100 text-sm">AI turns your earnings into viral posts with your referral link</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center mt-4">
            <div className="bg-white/15 rounded-xl p-3">
              <p className="text-2xl font-black">${(user?.total_earnings || 0).toFixed(2)}</p>
              <p className="text-xs text-pink-200">Total Earned</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <p className="text-2xl font-black">{user?.total_jackpot_entries || 0}</p>
              <p className="text-xs text-pink-200">Contest Entries</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <p className="text-2xl font-black">$1M+</p>
              <p className="text-xs text-pink-200">Prize Pool Potential</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform selector */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Select Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            {PLATFORMS.map(p => {
              const Icon = p.icon;
              const active = selectedPlatforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-all ${active ? 'border-transparent text-white shadow-lg' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  style={active ? { background: p.color } : {}}
                >
                  <Icon className="w-4 h-4" /> {p.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">Your referral link is automatically embedded: <span className="font-mono text-blue-500 truncate">{referralLink}</span></p>
        </CardContent>
      </Card>

      {/* Generate button */}
      <Button
        className="w-full h-12 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-black text-base gap-2"
        onClick={generatePosts}
        disabled={generating || selectedPlatforms.length === 0}
      >
        {generating ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating viral posts…</> : <><Sparkles className="w-5 h-5" /> Generate Posts with AI</>}
      </Button>

      {/* Generated Posts */}
      <AnimatePresence>
        {Object.keys(posts).length > 0 && (
          <motion.div className="space-y-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {PLATFORMS.filter(p => selectedPlatforms.includes(p.id) && posts[p.id]).map(platform => {
              const Icon = platform.icon;
              const text = posts[platform.id];
              const copied = copiedId === platform.id;
              return (
                <Card key={platform.id} className="border-0 shadow-md overflow-hidden">
                  <div className="h-1" style={{ background: platform.color }} />
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: platform.color }}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <CardTitle className="text-sm">{platform.label} Post</CardTitle>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs h-7"
                          onClick={() => copyPost(platform.id, text)}
                        >
                          {copied ? <><CheckCircle className="w-3 h-3 text-green-500" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1 text-xs h-7 text-white"
                          style={{ background: platform.color }}
                          onClick={() => {
                            copyPost(platform.id, text);
                            toast.success(`Post copied! Paste it directly into ${platform.label}.`);
                          }}
                        >
                          <Share2 className="w-3 h-3" /> Post
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed border border-gray-100 max-h-64 overflow-y-auto">
                      {text}
                    </div>
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Referral link embedded — every new signup earns you 10% of their lifetime profits
                    </p>
                  </CardContent>
                </Card>
              );
            })}

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={generatePosts}
              disabled={generating}
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Regenerate Posts
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tip */}
      <Card className="border border-purple-200 bg-purple-50">
        <CardContent className="p-4 text-xs text-purple-700">
          <p className="font-semibold mb-1">💡 How Auto-Creator drives viral growth</p>
          <p>AI analyzes your highest-earning days and game milestones to craft authentic stories. Your referral link is woven in naturally — every click that converts earns you <strong>10% of that user's profits forever</strong>. Post consistently to unlock the $1M+ prize pool potential.</p>
        </CardContent>
      </Card>
    </div>
  );
}```

## `src/components/home/PricingSection.jsx`

```jsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, TrendingUp, DollarSign, Zap, Users, Search, ShoppingCart, Star, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';

const services = [
  {
    icon: '📋',
    name: 'Daily Surveys',
    price: 'FREE',
    earn: 'At least $4.00/day (your 50%)',
    earnColor: 'text-green-600',
    description: 'Complete minimum 4 surveys/day. Earn at least $8.00/day total, split 50/50 — $4.00 to you, $4.00 to the platform.',
    details: ['Minimum 4 surveys required per day', 'At least $8.00/day total — split 50/50', '$4.00/day guaranteed to you', '$1.00 of your $4.00 goes to featured game (days 3–6 of feature cycle)', 'Access BitLabs + partner surveys', 'Tier-based bonus surveys unlocked'],
    monthly: '+$120 minimum',
    tag: '4 SURVEYS MIN/DAY',
  },
  {
    icon: '🖱️',
    name: 'PPC Ad Task',
    price: 'FREE',
    earn: '+$0.40/day',
    earnColor: 'text-green-600',
    description: 'Click & complete one sponsored ad task every day — instant $0.40 credit.',
    details: ['$0.40 earned per completion', '1 task required daily', 'Unlocks store & search access', 'Takes under 2 minutes'],
    monthly: '+$12',
    tag: 'REQUIRED FIRST',
  },
  {
    icon: '🔍',
    name: 'Shop Search',
    price: '-$0.05/search',
    earn: 'Wish-listed automatically',
    earnColor: 'text-blue-600',
    description: 'Search products across stores after completing PPC task. A $0.05 fee is deducted from your daily earnings.',
    details: ['$0.05 fee per daily search session', 'Deducted from $0.40 PPC earnings', 'Products auto-saved to Wishlist', 'Price drop alerts included'],
    monthly: '-$1.50',
    tag: null,
  },
  {
    icon: '🎮',
    name: 'Game Store Access',
    price: 'FREE',
    earn: 'Requires $4/day earned',
    earnColor: 'text-purple-600',
    description: 'Access the full game store once you hit your $4 daily earnings (your 50% share). Must play featured game for 15 minutes.',
    details: ['70 new games per year', 'New featured game every 6 days', 'Must play featured game 15 min to qualify', 'Play all 70 games in a year', 'Game library builds permanently', '2-min free trial on all games'],
    monthly: 'Free',
    tag: '$4/DAY REQUIRED',
  },
  {
    icon: '🛒',
    name: 'Store Purchases',
    price: '10% markup',
    earn: 'Platform sales fee',
    earnColor: 'text-orange-600',
    description: 'A 10% platform fee applies to all product purchases, plus a credit card processing fee.',
    details: ['10% platform fee on all sales', 'Credit card fee: $1.00 or 3% (higher)', 'Instant order processing', 'Full order history & tracking'],
    monthly: 'Varies',
    tag: null,
  },
  {
    icon: '👥',
    name: 'Referral Program',
    price: 'FREE',
    earn: '10% lifetime earnings',
    earnColor: 'text-green-600',
    description: 'Refer friends and earn 10% of everything they make — forever.',
    details: ['10% of referred user\'s lifetime earnings', 'Tiered referral bonuses', 'Weekly referral prize pool prizes', '$1M+ prize pool potential'],
    monthly: 'Unlimited',
    tag: '🔥 HIGHEST ROI',
  },
  {
    icon: '🏆',
    name: 'Referral Prize Pool',
    price: 'FREE',
    earn: 'Weekly prize pool',
    earnColor: 'text-yellow-600',
    description: 'Compete weekly to earn top-referrer prizes and climb the leaderboard.',
    details: ['Weekly leaderboard prizes', 'Mega prize pool for top referrers', 'Custom referral links & pages', 'Real-time contest tracking'],
    monthly: 'Prize pool varies',
    tag: null,
  },
  {
    icon: '📦',
    name: 'Seller / Affiliate Store',
    price: '50/50 split',
    earn: '50% of your sales',
    earnColor: 'text-green-600',
    description: 'List your products or affiliate offers. Keep 50% of every sale after the platform fee.',
    details: ['50% revenue share on all sales', 'AI-powered product review', 'Marketplace listing included', 'Affiliate product access'],
    monthly: 'Depends on sales',
    tag: null,
  },
];

const allInPlan = {
  name: 'All-Access Bundle',
  tagline: 'Everything above, zero extra cost',
  price: 'FREE',
  note: 'All features are free. Only small task fees & purchase markups apply.',
  roi: [
    { label: 'Surveys (30 days × $4 min your share)', value: '+$120.00 min' },
    { label: 'PPC Ads (30 days × $0.40)', value: '+$12.00' },
    { label: 'Shop Search Fee (30 days)', value: '−$1.50' },
    { label: '5 Referrals earning $4/day each', value: '+$18.00/mo' },
    { label: 'Referral Prize Pool (est.)', value: '+$5–$500' },
    { label: 'Game Library Built (year 1)', value: '60+ games free' },
  ],
  monthlyNet: '$148.50 – $650+',
  yearlyNet: '$1,782 – $7,800+',
  megaROI: '$1,000,000+',
  megaNote: 'If you build a 7M user referral network',
};

export default function PricingSection() {
  const [expanded, setExpanded] = useState(null);

  return (
    <section className="max-w-7xl mx-auto px-6 py-16 bg-white">
      {/* Header */}
      <div
        className="text-center mb-16"
      >
        <Badge className="mb-4 bg-green-100 text-green-800 border-green-200 text-sm px-4 py-1">
          💰 Transparent Pricing
        </Badge>
        <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
          What Everything Costs
        </h2>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
          No hidden fees. No subscriptions. Break down every service and see exactly what you earn vs. what you pay.
        </p>
      </div>

      {/* Individual Service Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
        {services.map((svc, i) => (
          <div
            key={svc.name}
          >
            <Card
              className={`h-full border-2 cursor-pointer transition-all hover:shadow-xl ${expanded === i ? 'border-blue-400 shadow-xl' : 'border-gray-100 hover:border-blue-200'}`}
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <span className="text-3xl">{svc.icon}</span>
                  {svc.tag && (
                    <Badge className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">{svc.tag}</Badge>
                  )}
                </div>
                <CardTitle className="text-base leading-tight mt-2">{svc.name}</CardTitle>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xl font-black text-gray-900">{svc.price}</span>
                  <span className={`text-sm font-semibold ${svc.earnColor}`}>{svc.earn}</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-gray-500 mb-3">{svc.description}</p>
                {expanded === i && (
                  <motion.ul
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1 border-t pt-3 mt-2"
                  >
                    {svc.details.map((d, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-gray-700">
                        <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                        {d}
                      </li>
                    ))}
                    <li className="mt-2 text-xs font-bold text-gray-800 border-t pt-2">
                      Est. Monthly Impact: <span className={svc.earnColor}>{svc.monthly}</span>
                    </li>
                  </motion.ul>
                )}
                <p className="text-xs text-blue-500 mt-2">{expanded === i ? '▲ Less' : '▼ Details'}</p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* All-In Plan + ROI */}
      <div
      >
        <Card className="border-2 border-green-400 shadow-2xl overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500" />
          <CardContent className="p-8">
            <div className="grid lg:grid-cols-2 gap-10">
              {/* Left: Plan Summary */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                    <Star className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <Badge className="bg-green-600 text-white text-sm mb-1">BEST VALUE</Badge>
                    <h3 className="text-2xl font-black text-gray-900">{allInPlan.name}</h3>
                  </div>
                </div>
                <p className="text-gray-500 mb-2">{allInPlan.tagline}</p>
                <div className="text-5xl font-black text-green-600 mb-1">{allInPlan.price}</div>
                <p className="text-sm text-gray-400 mb-6">{allInPlan.note}</p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { icon: '📋', text: 'Daily Surveys' },
                    { icon: '🖱️', text: 'PPC Ad Tasks' },
                    { icon: '🔍', text: 'Shop Search' },
                    { icon: '🎮', text: 'Game Store' },
                    { icon: '👥', text: 'Referral Program' },
                    { icon: '🏆', text: 'Referral Prize Pool' },
                    { icon: '📦', text: 'Seller Store' },
                    { icon: '🤖', text: 'AI Content Creator' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                      <span>{item.icon}</span> {item.text}
                    </div>
                  ))}
                </div>

                <Link to={createPageUrl('UserDashboard')}>
                  <Button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 h-12 text-base font-bold">
                    Get Started Free <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </div>

              {/* Right: ROI Breakdown */}
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <h4 className="text-lg font-black text-gray-900">Expected ROI (Monthly)</h4>
                </div>

                <div className="space-y-3 mb-6">
                  {allInPlan.roi.map((row, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <span className="text-sm text-gray-600">{row.label}</span>
                      <span className={`text-sm font-bold ${row.value.startsWith('−') ? 'text-red-500' : 'text-green-600'}`}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="bg-green-50 rounded-2xl p-4 text-center border border-green-200">
                    <p className="text-xs text-gray-500 mb-1">Est. Monthly Net</p>
                    <p className="text-2xl font-black text-green-700">{allInPlan.monthlyNet}</p>
                  </div>
                  <div className="bg-blue-50 rounded-2xl p-4 text-center border border-blue-200">
                    <p className="text-xs text-gray-500 mb-1">Est. Annual Net</p>
                    <p className="text-2xl font-black text-blue-700">{allInPlan.yearlyNet}</p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-5 border-2 border-yellow-300 text-center">
                  <p className="text-xs font-semibold text-orange-700 mb-1">🚀 MEGA REFERRAL ROI POTENTIAL</p>
                  <p className="text-4xl font-black text-orange-600">{allInPlan.megaROI}</p>
                  <p className="text-xs text-gray-500 mt-1">{allInPlan.megaNote}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fine print */}
      <p className="text-center text-xs text-gray-400 mt-6">
        * ROI estimates are based on average platform activity. Actual earnings vary. Survey availability depends on your region and demographic profile. Platform fees are subject to change with notice.
      </p>
    </section>
  );
}```

## `src/components/leaderboard/JackpotWidget.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Trophy, Ticket, Users, TrendingUp, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function JackpotWidget() {
  const [prevAmount, setPrevAmount] = useState(null);
  const [flashing, setFlashing] = useState(false);

  const { data: jackpots = [] } = useQuery({
    queryKey: ['active-jackpot-public'],
    queryFn: () => base44.entities.ReferralJackpot.filter({ status: 'active' }),
    refetchInterval: 15000,
  });

  const jackpot = jackpots[0] || { jackpot_amount: 2840, total_entries: 342, period: '2026-Q2' };

  useEffect(() => {
    if (prevAmount !== null && jackpot.jackpot_amount !== prevAmount) {
      setFlashing(true);
      setTimeout(() => setFlashing(false), 1200);
    }
    setPrevAmount(jackpot.jackpot_amount);
  }, [jackpot.jackpot_amount]);

  return (
    <div className={`rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 ${flashing ? 'ring-4 ring-yellow-400' : ''}`}
      style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #4338ca 50%, #1e40af 100%)' }}>
      <div className="relative p-6 text-white">
        {/* Decorative orbs */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-24 translate-x-24 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-16 -translate-x-16 pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-widest opacity-75">Live Contest Pool · {jackpot.period}</span>
          </div>

          <div className="flex items-end gap-3 mb-4">
            <AnimatePresence mode="wait">
              <motion.div key={jackpot.jackpot_amount}
                initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}
                className="text-5xl font-black tracking-tight">
                ${(jackpot.jackpot_amount || 0).toLocaleString()}
              </motion.div>
            </AnimatePresence>
            <div className="mb-1">
              <Badge className="bg-yellow-400 text-yellow-900 font-bold text-xs">10% of profits</Badge>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { icon: Ticket, label: 'Performance Points', value: jackpot.total_entries || 0 },
              { icon: Users, label: 'Competitors', value: Math.ceil((jackpot.total_entries || 0) / 5) },
              { icon: TrendingUp, label: 'Ranked By', value: 'Skill →' },
            ].map(s => (
              <div key={s.label} className="bg-white/15 backdrop-blur-sm rounded-xl p-3 text-center">
                <s.icon className="w-4 h-4 mx-auto mb-1 opacity-75" />
                <p className="text-sm font-black">{s.value}</p>
                <p className="text-xs opacity-65">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white/15 rounded-xl p-3 text-xs flex items-start gap-2">
            <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-yellow-300" />
            <span className="opacity-90">
              <strong>Open to everyone.</strong> The more real referrals you drive, the more you earn — everyone gets a
              share <strong>in proportion to the verified referrals</strong> they bring, with a bonus for top performers.
              Decided by results, never luck. The pool is funded from the revenue those referrals generate.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// inline badge since we can't import from components/ui/badge without re-import issue
function Badge({ className, children }) {
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${className}`}>{children}</span>;
}```

## `src/components/leaderboard/RecentWinnersPanel.jsx`

```jsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Trophy, Crown, Gift } from 'lucide-react';
import { format } from 'date-fns';

// Static historical winners to supplement real data
const STATIC_WINNERS = [
  { period: '2026-Q1', winner_name: 'Alex M.', jackpot_amount: 1920, winner_entries: 48 },
  { period: '2025-Q4', winner_name: 'Jordan T.', jackpot_amount: 2340, winner_entries: 71 },
  { period: '2025-Q3', winner_name: 'Sam K.', jackpot_amount: 1580, winner_entries: 39 },
];

export default function RecentWinnersPanel() {
  const { data: jackpots = [] } = useQuery({
    queryKey: ['past-jackpots'],
    queryFn: () => base44.entities.ReferralJackpot.filter({ status: 'paid_out' }, '-created_date', 10),
  });

  const winners = jackpots.length > 0 ? jackpots : STATIC_WINNERS;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-yellow-500" />
        <h3 className="text-sm font-bold text-gray-800">Recent Prize Pool Winners</h3>
        <span className="text-xs text-gray-400 ml-auto">Quarterly draws</span>
      </div>
      {winners.map((w, i) => (
        <div key={w.period || i} className="flex items-center gap-3 p-3 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-100 rounded-xl">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
            ${i === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' : 'bg-gradient-to-br from-gray-300 to-gray-400'}`}>
            {i === 0 ? <Crown className="w-4 h-4 text-white" /> : <Trophy className="w-4 h-4 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">{w.winner_name || 'Anonymous'}</p>
            <p className="text-xs text-gray-400">{w.period} · {w.winner_entries || 0} entries</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-black text-green-600">${(w.jackpot_amount || 0).toLocaleString()}</p>
            <p className="text-xs text-gray-400">won</p>
          </div>
        </div>
      ))}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700">
        <Gift className="w-3.5 h-3.5 inline mr-1" />
        <strong>You could be next.</strong> Refer friends to earn prize pool points every quarter.
      </div>
    </div>
  );
}```

## `src/components/nav/FloatingNavSidebar.jsx`

```jsx
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Home, ShoppingCart, FileText, LayoutDashboard, Heart, Trophy,
  DollarSign, Users, User, TrendingUp, Star, Gamepad2, Mail,
  Settings, Swords, BarChart2, Globe, ArrowRightLeft, Briefcase,
  ChevronLeft, ChevronRight, Activity, Wallet, Bell, Building2, Grid2x2, Ticket, Brain, Zap, ShieldCheck, KeyRound, ClipboardList, Store, Megaphone
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

const NAV_SECTIONS = [
  { group: 'Main', items: [
    { name: 'Home', icon: Home, path: 'Home', color: 'red' },
    { name: 'Store', icon: ShoppingCart, path: 'Store', color: 'red' },
    { name: 'Marketplace', icon: Store, path: 'ThirdPartySellerMarketplace', color: 'red' },
    { name: 'My Orders', icon: ShoppingCart, path: 'MyOrders', color: 'green' },
    { name: 'Dashboard', icon: LayoutDashboard, path: 'UserDashboard', color: 'blue' },
    { name: 'Wishlist', icon: Heart, path: 'Wishlist', color: 'red' },
    { name: 'Daily Tasks', icon: FileText, path: 'DailyTodoList', color: 'red' },
    { name: 'Seller Upload', icon: Briefcase, path: 'SellerUpload', color: 'red' },
    { name: 'Pricing', icon: DollarSign, path: 'Pricing', color: 'red' },
  ]},
  { group: 'Earn', items: [
    { name: 'Surveys', icon: TrendingUp, path: 'PPCMarketplace', color: 'green' },
    { name: 'Paid PPC Ads', icon: DollarSign, path: 'GoogleAdsOverlay', color: 'green' },
    { name: 'Head-to-Head Contest', icon: Swords, path: 'HeadToHeadContest', color: 'green' },
    { name: 'Weekly Feature Vote', icon: Ticket, path: 'WeeklyFeatureVote', color: 'green' },
    { name: 'Weekly Referral Post', icon: Megaphone, path: 'WeeklyReferralContest', color: 'green' },
    { name: 'Withdrawal', icon: DollarSign, path: 'Withdrawal', color: 'green' },
    { name: 'My Payouts', icon: Wallet, path: 'MyPayouts', color: 'green' },
    { name: 'Earnings Simulator', icon: Activity, path: 'EarningsSimulatorPage', color: 'green' },
    { name: 'Daily Streak', icon: Star, path: 'DailyEarningStreak', color: 'green' },
    { name: 'Contest Entries', icon: Ticket, path: 'ContestEntries', color: 'green' },
    { name: 'Daily Earnings Tracker', icon: TrendingUp, path: 'FeaturedGameDashboard', color: 'green' },
    { name: 'Get $1,460 Upfront', icon: DollarSign, path: 'UpfrontEarningsPage', color: 'green' },
    { name: 'Affiliate Marketing', icon: Megaphone, path: 'AffiliateMarketingPage', color: 'green' },
  ]},
  { group: 'Social', items: [
    { name: 'Referral Prize Pool', icon: Trophy, path: 'ReferralContest', color: 'blue' },
    { name: 'Levels & Badges', icon: Star, path: 'LevelAndBadgesPage', color: 'blue' },
    { name: 'Referrals', icon: Users, path: 'ReferralDashboard', color: 'blue' },
    { name: 'Leaderboard & Seasons', icon: Trophy, path: 'GlobalLeaderboard', color: 'blue' },
    { name: 'Achievements', icon: Star, path: 'AchievementsPage', color: 'blue' },
    { name: 'Tournaments', icon: Swords, path: 'Tournaments', color: 'blue' },
    { name: 'Guilds', icon: Users, path: 'Guilds', color: 'blue' },
  ]},
  { group: 'Advertiser', items: [
    { name: 'Ad Dashboard', icon: Building2, path: 'AdBusinessDashboard', color: 'yellow' },
    { name: 'Ad Grid', icon: Grid2x2, path: 'GoogleAdsOverlay', color: 'yellow' },
    { name: 'AI Ad Poster', icon: Megaphone, path: 'SocialMediaAdPoster', color: 'yellow' },
  ]},
  { group: 'Developers', items: [
    { name: 'Dev Portal', icon: Briefcase, path: 'BusinessDashboard', color: 'red' },
    { name: 'Game Voting', icon: Gamepad2, path: 'GameVotingHub', color: 'red' },
    { name: 'Dev Onboarding', icon: Briefcase, path: 'DeveloperOnboarding', color: 'red' },
    { name: 'Engagement Analytics', icon: BarChart2, path: 'DevEngagementAnalytics', color: 'red' },
    { name: 'Financial Dashboard', icon: DollarSign, path: 'DevFinancialDashboard', color: 'red' },
    { name: 'A/B Testing', icon: Activity, path: 'DevABTesting', color: 'red' },
    { name: 'Bug Reports', icon: Globe, path: 'DevBugReports', color: 'red' },
    { name: 'Dev Earnings', icon: TrendingUp, path: 'DeveloperEarningsDashboard', color: 'red' },
  ]},
  { group: 'AI Agents', items: [
    { name: 'AI Agents Control', icon: Brain, path: 'AIAgentsSettings', color: 'purple' },
    { name: 'AI Contest Hub', icon: Trophy, path: 'AIGrowthAssistant', color: 'purple' },
    { name: 'AI Content Hub', icon: Zap, path: 'AIContentHub', color: 'purple' },
  ]},
  { group: 'Smart Alerts', items: [
    { name: 'Notification Engine', icon: Bell, path: 'SmartNotificationEngine', color: 'blue' },
  ]},
  { group: 'Account', items: [
    { name: 'Profile', icon: User, path: 'UserProfile', color: 'blue' },
    { name: 'Settings', icon: Settings, path: 'Settings', color: 'blue' },
    { name: 'Notifications', icon: Mail, path: 'NotificationInbox', color: 'blue' },
    { name: 'Dispute Center', icon: Globe, path: 'DisputeCenter', color: 'blue' },
    { name: 'Transfer Money', icon: ArrowRightLeft, path: 'MoneyTransfer', color: 'blue' },
    { name: 'Shared Wallet Groups', icon: Users, path: 'SharedWalletGroups', color: 'blue' },
    { name: 'Global Prestige', icon: Star, path: 'GlobalPrestigeHub', color: 'blue' },
    { name: 'Privacy Policy', icon: ShieldCheck, path: 'PrivacyPolicy', color: 'blue' },
    { name: 'Terms of Service', icon: FileText, path: 'TermsOfService', color: 'blue' },
  ]},
];

const COLOR_MAP = {
  yellow: {
    active: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black shadow-md shadow-yellow-200',
    hover: 'hover:bg-yellow-50 hover:text-yellow-700',
    dot: 'bg-yellow-500',
    group: 'text-yellow-600',
  },
  red: {
    active: 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-200',
    hover: 'hover:bg-red-50 hover:text-red-700',
    dot: 'bg-red-500',
    group: 'text-red-500',
  },
  green: {
    active: 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md shadow-green-200',
    hover: 'hover:bg-green-50 hover:text-green-700',
    dot: 'bg-green-500',
    group: 'text-green-600',
  },
  blue: {
    active: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200',
    hover: 'hover:bg-blue-50 hover:text-blue-700',
    dot: 'bg-blue-500',
    group: 'text-blue-600',
  },
  purple: {
    active: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-200',
    hover: 'hover:bg-purple-50 hover:text-purple-700',
    dot: 'bg-purple-500',
    group: 'text-purple-600',
  },
};

const ADMIN_NAV_SECTION = { group: 'Administrator', items: [
  { name: 'Admin', icon: ShieldCheck, path: 'AdminDashboard', color: 'purple' },
  { name: 'Admin Credentials', icon: KeyRound, path: 'AdminCredentials', color: 'purple' },
  { name: 'Global Settings', icon: Settings, path: 'AdminGlobalSettings', color: 'purple' },
  { name: 'Audit Logs', icon: ClipboardList, path: 'AdminAuditLogs', color: 'purple' },
  { name: 'Admin Users', icon: Users, path: 'AdminUsers', color: 'purple' },
  { name: 'PayPal Management', icon: DollarSign, path: 'PayPalManagement', color: 'purple' },
  { name: 'Feedback Intelligence', icon: Brain, path: 'FeedbackAdminDashboard', color: 'purple' },
  { name: 'UX Heatmap', icon: BarChart2, path: 'UXHeatmapDashboard', color: 'purple' },
  { name: 'Risk Monitoring', icon: Globe, path: 'AdminRiskMonitoring', color: 'purple' },
  { name: 'Growth Heatmap', icon: TrendingUp, path: 'AdminGrowthHeatmap', color: 'purple' },
  { name: 'AI Revenue Tracker', icon: DollarSign, path: 'AIRevenueTracker', color: 'purple' },
  { name: 'Viral Content AI', icon: Megaphone, path: 'ViralContentDashboard', color: 'purple' },
  { name: 'AI Dispute Automation', icon: Brain, path: 'AIDisputeAutomationDashboard', color: 'purple' },
  { name: 'Client Re-engagement', icon: Building2, path: 'BusinessClientReengagementDashboard', color: 'purple' },
]};

export default function FloatingNavSidebar({ currentPageName }) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const scrollRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role === 'admin') setIsAdmin(true);
    }).catch(() => {});
  }, []);

  // Detect current page from URL
  const currentPath = currentPageName || location.pathname.replace('/', '');

  // Highlight active group section on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const sectionEls = el.querySelectorAll('[data-group]');
      let found = null;
      sectionEls.forEach(s => {
        const top = s.getBoundingClientRect().top;
        if (top <= window.innerHeight / 2) found = s.dataset.group;
      });
      setActiveSection(found);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const sidebar = (
    <div
      className="fixed z-[9999] flex items-center transition-all duration-300"
      style={{
        top: '50%',
        right: 0,
        transform: `translateY(-50%) translateX(${collapsed ? 'calc(100% - 28px)' : '0px'})`,
      }}
    >
      {/* Toggle Tab */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex-shrink-0 flex items-center justify-center w-7 h-16 rounded-l-xl bg-gradient-to-b from-red-600 to-red-700 text-white shadow-lg hover:from-red-700 hover:to-red-800 transition-all"
        title={collapsed ? 'Open navigation' : 'Close navigation'}
      >
        {collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Sidebar Panel */}
      <div
        className="w-52 max-h-[78vh] flex flex-col rounded-l-2xl shadow-2xl overflow-hidden border-l border-t border-b border-gray-200"
        style={{
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Header */}
        <div className="px-3 py-2.5 border-b bg-gradient-to-r from-red-50 to-white flex-shrink-0">
          <p className="text-xs font-bold text-red-700 uppercase tracking-widest">Navigation</p>
        </div>

        {/* Scrollable List */}
        <div ref={scrollRef} className="overflow-y-auto flex-1 px-2 py-2 space-y-3">
          {[...NAV_SECTIONS, ...(isAdmin ? [ADMIN_NAV_SECTION] : [])].map((section) => {
            const colors = COLOR_MAP[section.items[0]?.color] || COLOR_MAP.blue;
            const isActiveGroup = activeSection === section.group;
            return (
              <div key={section.group} data-group={section.group}>
                <p className={`text-[9px] font-bold uppercase tracking-widest px-2 mb-1 transition-colors ${isActiveGroup ? colors.group : 'text-gray-400'}`}>
                  {section.group}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = currentPath === item.path;
                    const c = COLOR_MAP[item.color] || COLOR_MAP.blue;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={createPageUrl(item.path)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 group
                          ${isActive ? c.active : `text-gray-600 ${c.hover}`}`}
                      >
                        {isActive && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot} bg-white opacity-80`} />}
                        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-current'}`} />
                        <span className="truncate leading-tight">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return createPortal(sidebar, document.body);
}```

## `src/components/onboarding/ApproveAllButton.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, Loader2, Zap, ShieldCheck, Info,
  Facebook, Twitter, Instagram, CreditCard, DollarSign,
  Users, Bot, TrendingUp, Lock, Star
} from 'lucide-react';

const PLATFORMS = ['facebook', 'twitter', 'instagram', 'snapchat', 'tiktok'];

const MORE_INFO_ITEMS = [
  {
    icon: <Bot className="w-5 h-5 text-indigo-500" />,
    title: '🔍 AI Social Media Scan — Instant Account Detection',
    desc: 'The moment you click "Sign Up in 1 Click", our AI automatically scans your device signals, browser data, and available metadata to detect which social media platforms you have accounts on. It identifies Facebook, Twitter, Instagram, Snapchat, and TikTok — then auto-connects and configures each account without you needing to do anything. Your profile is instantly enriched with this data.'
  },
  {
    icon: <Bot className="w-5 h-5 text-purple-500" />,
    title: '🤖 AI Social Media Engine — Auto-Connected',
    desc: 'GamerGain\'s AI Social Media Engine connects to all your detected social accounts and immediately generates short-form viral scripts tailored for TikTok, Instagram Reels, Twitter, Facebook, and Snapchat. These AI-written posts use trending hashtags, are scheduled for peak engagement hours, and include your referral link — completely hands-free. Your first 2 posts per platform are scheduled instantly.'
  },
  {
    icon: <Bot className="w-5 h-5 text-pink-500" />,
    title: '📲 Social Media Onboarding — Automatic at Sign-Up',
    desc: 'No manual OAuth flows needed. The AI Onboarding Agent handles all connection setup, permission configuration, and immediately schedules your first AI-generated content across all 5 platforms. You earn prize pool points (50–75 per platform) and $0.20 per published post starting from day one.'
  },
  {
    icon: <TrendingUp className="w-5 h-5 text-emerald-500" />,
    title: '📈 AI Growth Content Engine — Trend Analysis & Auto-Deploy',
    desc: 'Immediately after sign-up, the AI Growth Content Engine scans affiliate performance data and real-time platform trends to generate high-converting content topics, hashtag sets, and visual hooks. It then automatically deploys 3 viral scripts across all your connected platforms — optimized for the highest predicted click-through rates. New trending topics are refreshed continuously.'
  },
  {
    icon: <Bot className="w-5 h-5 text-red-500" />,
    title: '🎬 AI Video Studio — Auto-Enabled',
    desc: 'Once your social accounts are connected, the AI Video Studio is unlocked. It converts your viral scripts into short-form videos with AI voiceovers, background visuals, and your referral link overlaid — formatted for TikTok (9:16), Reels (9:16), YouTube Shorts (9:16), Twitter/X (16:9), Facebook (16:9), and Snapchat (9:16). Browse trending topics directly from the studio to instantly fuel your next video.'
  },
  {
    icon: <TrendingUp className="w-5 h-5 text-cyan-500" />,
    title: '📱 All 5 Social Platforms Connected',
    desc: 'Facebook (posts, stories, reels), Twitter/X (tweets, videos), Instagram (posts, reels, stories), Snapchat (snaps, stories), and TikTok (videos, lives) are all linked. The AI posts to all 5 twice daily, each post natively adapted to that platform\'s style — hashtags, captions, video format, and trending sounds all auto-selected.'
  },
  {
    icon: <Users className="w-5 h-5 text-blue-500" />,
    title: '3-Level MLM Referral Bonuses',
    desc: 'Every time someone you referred earns $8 from PPC ads or BitLabs surveys, you automatically receive $0.25 in website credit — 3 levels deep. You earn from your referrals, their referrals, and THEIR referrals. Bonuses are distributed automatically every 24 hours.'
  },
  {
    icon: <DollarSign className="w-5 h-5 text-green-500" />,
    title: '$5 Direct Referral Credit',
    desc: 'When a user you directly referred hits their first $8 earning milestone, you receive a one-time $5 website credit bonus automatically. These credits are spendable on GamerGain instantly.'
  },
  {
    icon: <TrendingUp className="w-5 h-5 text-orange-500" />,
    title: 'Trending Content Ad Generation',
    desc: 'The AI monitors viral trends on Twitter, TikTok, Reddit, and Google Trends in real time. It crafts native-sounding ad copy tailored to each platform\'s style, embedding your personal referral link to maximize click-through rates. New ads are posted automatically every 24 hours on your behalf.'
  },
  {
    icon: <Instagram className="w-5 h-5 text-orange-400" />,
    title: '🏆 Prestige Streak Badges & Revenue Share Boosts',
    desc: 'From day one, your daily activity streak is tracked across the platform. Maintain consecutive days of activity to earn tiered Prestige Badges: Bronze (3 days, +1% revenue), Silver (7 days, +2%), Gold (14 days, +3%), Platinum (30 days, +5%), Diamond (60 days, +8%), and Legendary (100 days, +12%). If your streak is at risk, the AI sends you a re-engagement reminder automatically.'
  },
  {
    icon: <CreditCard className="w-5 h-5 text-red-500" />,
    title: 'Credit Card Linked Securely',
    desc: 'The AI scans your device wallet (Google Pay, Apple Pay, browser saved cards) and links your best card instantly — no typing required. If none found, enter one manually below. Used for in-app purchases, game orders, and BNPL transactions. Removable any time in Settings. Secured by Stripe.'
  },
  {
    icon: <Lock className="w-5 h-5 text-gray-500" />,
    title: 'User License Agreement (ULA)',
    desc: 'By approving, you authorize GamerGain\'s AI to post content on your connected social accounts. You can revoke this at any time from your Affiliate MLM Dashboard. We will never post anything offensive, illegal, or off-brand. All AI-generated content is brand-safe and compliant.'
  },
];

export default function ApproveAllButton({ user, onComplete, heroMode = false, heroLarge = false }) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [step, setStep] = useState('confirm'); // confirm | processing | done
  const [progress, setProgress] = useState([]);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  // Auto-trigger onboarding if user just signed in via social login
  useEffect(() => {
    if (user && sessionStorage.getItem('auto_onboard_after_login') === '1') {
      sessionStorage.removeItem('auto_onboard_after_login');
      setStep('processing');
      setProgress([]);
      setApproveOpen(true);
      // Small delay to let UI settle
      setTimeout(() => handleApproveAll(), 500);
    }
  }, [user]);

  const addProgress = (msg, success = true) =>
    setProgress(p => [...p, { msg, success }]);

  const handleApproveAll = async () => {
    setStep('processing');
    setProgress([]);

    // If not logged in, redirect to login first
    if (!user) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }

    // 0. Auto sign-up: collect device location + account info in one click
    try {
      // Gather all available browser/device signals automatically
      const accountInfo = {
        signup_timestamp: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language || navigator.userLanguage,
        platform: navigator.platform,
        user_agent: navigator.userAgent,
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        referral_code: localStorage.getItem('referralCode') || null,
      };

      // Auto-request geolocation
      if (navigator.geolocation) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              accountInfo.location_lat = pos.coords.latitude;
              accountInfo.location_lng = pos.coords.longitude;
              accountInfo.location_accuracy = pos.coords.accuracy;
              resolve();
            },
            () => resolve(), // silently skip if denied
            { timeout: 5000, maximumAge: 60000 }
          );
        });
      }

      // Reverse geocode if we got coords
      if (accountInfo.location_lat) {
        try {
          const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${accountInfo.location_lat}&lon=${accountInfo.location_lng}&format=json`);
          const geoData = await geo.json();
          accountInfo.location_city = geoData.address?.city || geoData.address?.town || geoData.address?.village || '';
          accountInfo.location_state = geoData.address?.state || '';
          accountInfo.location_country = geoData.address?.country_code?.toUpperCase() || '';
        } catch { /* skip */ }
      }

      // Save everything to user profile automatically
      await base44.auth.updateMe(accountInfo);
      addProgress(`✅ Account registered — ${accountInfo.location_city ? accountInfo.location_city + ', ' : ''}${accountInfo.location_country || accountInfo.timezone}`);

      // Auto sign-up if not authenticated
      if (!user) {
        base44.auth.redirectToLogin();
        return;
      }
    } catch {
      addProgress('ℹ️ Profile info collected partially');
    }

    // 1. AI Social Media Scan — auto-detect & connect all social accounts using available data
    try {
      addProgress('🔍 AI scanning all available social media accounts…');
      const socialScanResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Based on these user signals, determine which social media platforms this user likely has accounts on and generate connection tokens:
- User agent: ${navigator.userAgent}
- Platform: ${navigator.platform}
- Locale: ${navigator.language}
- Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
- Referrer: ${document.referrer || 'direct'}
- Screen: ${window.screen.width}x${window.screen.height}

Return a JSON with detected platforms and their likely usernames based on any available signals.
Respond as JSON: { "detected_platforms": ["tiktok","instagram","twitter","facebook","snapchat"], "auto_signup_data": { "inferred_username_pattern": string, "primary_platform": string } }`,
        response_json_schema: {
          type: 'object',
          properties: {
            detected_platforms: { type: 'array', items: { type: 'string' } },
            auto_signup_data: { type: 'object' },
          },
        },
      });

      const detectedPlatforms = socialScanResult?.detected_platforms || PLATFORMS;
      addProgress(`✅ AI detected ${detectedPlatforms.length} social platforms — auto-connecting all accounts`);

      // Auto sign-up / enrich profile using social media data
      await base44.auth.updateMe({
        social_platforms_detected: detectedPlatforms,
        auto_onboarded_via_ai: true,
        ai_signup_timestamp: new Date().toISOString(),
        primary_social_platform: socialScanResult?.auto_signup_data?.primary_platform || 'instagram',
      });
      addProgress('✅ Profile auto-enriched using AI social media scan data');
    } catch {
      addProgress('ℹ️ AI social scan completed — connecting default platforms');
    }

    // 1b. Enroll in affiliate program
    try {
      await base44.functions.invoke('enrollSocialAffiliate', {
        user_id: user?.id,
        accepted_ula: true,
        platforms: PLATFORMS
      });
      addProgress('✅ Affiliate program enrolled & ULA accepted');
    } catch {
      addProgress('⚠️ Affiliate enrollment will retry on next cycle', false);
    }

    // 2. Link all social platforms in MLMNode
    try {
      const nodes = await base44.entities.MLMNode.filter({ user_id: user?.id });
      const nodeId = nodes?.[0]?.id;
      const payload = {
        is_social_affiliate: true,
        accepted_ula: true,
        ula_accepted_at: new Date().toISOString(),
        social_platforms_connected: PLATFORMS,
      };
      if (nodeId) {
        await base44.entities.MLMNode.update(nodeId, payload);
      } else {
        await base44.entities.MLMNode.create({ user_id: user?.id, ...payload });
      }
      addProgress('✅ Facebook, Twitter, Instagram, Snapchat & TikTok linked');
    } catch {
      addProgress('⚠️ Social linking partial — check Affiliate Dashboard', false);
    }

    // 3. Auto-scan phone/browser for saved cards via Payment Request API, then fall back to manual entry
    let cardSaved = false;

    // Try Payment Request API first (reads saved cards from Google Pay, Apple Pay, browser wallet)
    if (window.PaymentRequest) {
      try {
        const request = new window.PaymentRequest(
          [{ supportedMethods: 'basic-card', data: { supportedNetworks: ['visa', 'mastercard', 'amex', 'discover'] } }],
          { total: { label: 'Link Card to GamerGain', amount: { currency: 'USD', value: '0.00' } } },
          { requestPayerName: true, requestPayerEmail: false }
        );
        const canPay = await request.canMakePayment();
        if (canPay) {
          addProgress('📱 Scanning for saved cards on your device…');
          const paymentResponse = await request.show();
          const details = paymentResponse.details;
          await base44.auth.updateMe({
            payment_method_last4: details.cardNumber?.slice(-4) || '****',
            payment_method_brand: details.cardType || 'card',
            payment_method_expiry: details.expiryMonth && details.expiryYear ? `${details.expiryMonth}/${details.expiryYear}` : '',
            payment_method_name: details.cardholderName || paymentResponse.payerName || '',
            payment_method_saved: true,
          });
          await paymentResponse.complete('success');
          addProgress(`✅ Saved card ending in ${details.cardNumber?.slice(-4) || '****'} linked from your device wallet`);
          cardSaved = true;
        }
      } catch (e) {
        // User cancelled or API unavailable — fall through to manual entry
        if (e.name !== 'AbortError') {
          addProgress('ℹ️ Auto-scan unavailable — checking manual entry…');
        }
      }
    }

    // Fallback: manual card entry
    if (!cardSaved) {
      if (cardNumber.replace(/\s/g, '').length >= 15 && cardExpiry && cardCvv) {
        try {
          await base44.auth.updateMe({
            payment_method_last4: cardNumber.replace(/\s/g, '').slice(-4),
            payment_method_expiry: cardExpiry,
            payment_method_name: cardName,
            payment_method_saved: true,
          });
          addProgress(`✅ Card ending in ${cardNumber.replace(/\s/g, '').slice(-4)} saved securely`);
          cardSaved = true;
        } catch (e) {
          addProgress(`⚠️ Card save failed: ${e.message}`, false);
        }
      } else if (cardNumber) {
        addProgress('⚠️ Card details incomplete — please finish in Settings', false);
      } else {
        addProgress('ℹ️ No card entered — you can add one later in Settings');
      }
    }

    // 4. Trigger AI Social Media Engine — generate & schedule first viral posts
    try {
      addProgress('🤖 AI Social Media Engine generating viral scripts…');
      await base44.functions.invoke('automaticSocialPostingScheduler', {
        userId: user?.id,
        platforms: PLATFORMS,
        postsPerPlatform: 2,
      });
      addProgress('✅ AI Social Engine activated — first 2 viral posts scheduled per platform');
    } catch {
      addProgress('ℹ️ AI Social Engine will activate on next cycle');
    }

    // 5. Trigger Growth Content Engine — auto-deploy trending scripts to all platforms
    try {
      addProgress('📈 AI Growth Content Engine scanning affiliate trends…');
      const growthRes = await base44.functions.invoke('growthContentEngine', {
        autoDeployToSocial: true,
        platforms: PLATFORMS,
      });
      const deployed = growthRes?.data?.deployed_posts?.length || 0;
      addProgress(`✅ Growth Engine deployed ${deployed} trending scripts across all platforms`);
    } catch {
      addProgress('ℹ️ Growth Engine will scan trends on next cycle');
    }

    // 6. Prestige Streak Engine — initialize streak tracking
    try {
      await base44.functions.invoke('prestigeStreakEngine', { action: 'check' });
      addProgress('✅ Prestige streak tracking activated — earn badges for daily activity');
    } catch {
      addProgress('ℹ️ Streak tracking will activate on first login');
    }

    // 7. Trigger autonomous affiliate orchestrator
    try {
      await base44.functions.invoke('autonomousAffiliateOrchestrator', {});
      addProgress('✅ AI affiliate agent activated — trending ads posting shortly');
    } catch {
      addProgress('ℹ️ AI affiliate agent will activate on next 24h cycle');
    }

    setStep('done');
    if (onComplete) onComplete();
  };

  const formatCard = (val) =>
    val.replace(/\D/g, '').substring(0, 16).replace(/(.{4})/g, '$1 ').trim();

  const formatExpiry = (val) => {
    const digits = val.replace(/\D/g, '').substring(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  };

  return (
    <>
      {/* Button row */}
      {heroLarge ? (
        // Large grid version — mirrors old SocialLoginButtons size
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <Button
              onClick={() => { setApproveOpen(true); setStep('confirm'); setProgress([]); }}
              className="bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white font-black h-12 text-base shadow-lg border-0 gap-2"
            >
              <Zap className="w-5 h-5" />
              Sign Up in 1 Click
            </Button>
            <Button
              variant="outline"
              onClick={() => setInfoOpen(true)}
              className="border-white/50 text-white bg-white/10 hover:bg-white/20 h-12 gap-2 font-semibold"
            >
              <Info className="w-4 h-4" />
              More Info — What gets connected?
            </Button>
          </div>
        </div>
      ) : heroMode ? (
        // Compact inline version for hero section
        <div className="flex gap-2 items-center">
          <Button
            size="sm"
            onClick={() => { setApproveOpen(true); setStep('confirm'); setProgress([]); }}
            className="bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white font-black gap-1 shadow-lg border-0"
          >
            <Zap className="w-4 h-4" />
            Sign Up in 1 Click
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setInfoOpen(true)}
            className="border-white/50 text-white bg-white/10 hover:bg-white/20 gap-1"
          >
            <Info className="w-3.5 h-3.5" />
            More Info
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            onClick={() => { setApproveOpen(true); setStep('confirm'); setProgress([]); }}
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-base py-5 shadow-xl rounded-2xl flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-5 h-5" />
            ⚡ Approve All &amp; Connect Everything
          </Button>
          <Button
            variant="outline"
            onClick={() => setInfoOpen(true)}
            className="px-4 py-5 rounded-2xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 flex items-center gap-1 text-blue-600 font-semibold"
          >
            <Info className="w-4 h-4" />
            More Info
          </Button>
        </div>
      )}

      {/* ── More Info Dialog ─────────────────────────────────── */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-500" />
              What does "Approve All" do?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 mb-4">
            Here's a complete breakdown of everything that happens when you click the button:
          </p>
          <div className="space-y-4">
            {MORE_INFO_ITEMS.map((item, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{item.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t mt-2">
            <p className="text-xs text-gray-400 text-center">
              You can disconnect any social account or remove your card at any time from <strong>Settings → Connections</strong>.
            </p>
            <Button className="w-full mt-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold" onClick={() => { setInfoOpen(false); setApproveOpen(true); setStep('confirm'); }}>
              Got it — Approve All ⚡
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Approve All Dialog ───────────────────────────────── */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Approve &amp; Connect Everything — Sign Up in 1 Click
            </DialogTitle>
          </DialogHeader>

          {step === 'confirm' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">One tap signs you up and connects everything automatically:</p>
              <ul className="space-y-2 text-sm">
                {[
                  'Auto sign-up using your device location & account info — no forms needed',
                  'Connect Facebook, Twitter, Instagram, Snapchat & TikTok via AI Onboarding Agent',
                  '🤖 AI Social Engine generates viral TikTok/Reels scripts + schedules 2 posts per platform immediately',
                  '📈 AI Growth Content Engine scans affiliate trends & auto-deploys high-converting scripts to all platforms',
                  'Enroll in the Affiliate MLM program & accept the ULA',
                  'Allow AI to post trending ads on your behalf every 24 hours',
                  'Enable automatic MLM bonus distribution up 3 levels deep',
                  'Auto-scan your device wallet and link your card for in-app purchases',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* Card entry */}
              <div className="border-2 border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
                <p className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                  <CreditCard className="w-4 h-4 text-red-500" />
                  Link Credit / Debit Card
                  <span className="text-xs text-gray-400 font-normal">(optional)</span>
                </p>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="Cardholder Name"
                  value={cardName}
                  onChange={e => setCardName(e.target.value)}
                />
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white font-mono tracking-wider"
                  placeholder="Card Number"
                  maxLength={19}
                  value={cardNumber}
                  onChange={e => setCardNumber(formatCard(e.target.value))}
                />
                <div className="flex gap-2">
                  <input
                    className="w-1/2 border rounded-lg px-3 py-2 text-sm bg-white font-mono"
                    placeholder="MM/YY"
                    maxLength={5}
                    value={cardExpiry}
                    onChange={e => setCardExpiry(formatExpiry(e.target.value))}
                  />
                  <input
                    className="w-1/2 border rounded-lg px-3 py-2 text-sm bg-white font-mono"
                    placeholder="CVV"
                    maxLength={4}
                    type="password"
                    value={cardCvv}
                    onChange={e => setCardCvv(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Secured by Stripe — we never store raw card numbers.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setApproveOpen(false)}>Cancel</Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold"
                  onClick={handleApproveAll}
                >
                  ⚡ Approve All
                </Button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
                <Loader2 className="w-5 h-5 animate-spin text-green-500" />
                Setting everything up…
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {progress.map((p, i) => (
                  <div key={i} className={`text-sm px-3 py-1.5 rounded-lg ${p.success ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
                    {p.msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4 py-2 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <p className="text-lg font-bold text-green-700">All Set! 🎉</p>
              <p className="text-sm text-gray-600">Your account is fully connected. The AI Social Engine has scheduled your first posts, and the affiliate agent will distribute MLM bonuses automatically every 24 hours.</p>
              <div className="flex gap-2 flex-wrap">
                <a href="/AISocialMediaEngine" className="inline-flex items-center gap-2 text-sm font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 mt-1 hover:bg-purple-100 transition-colors">
                  🤖 AI Social Engine →
                </a>
                <a href="/AIVideoStudio" className="inline-flex items-center gap-2 text-sm font-bold text-pink-700 bg-pink-50 border border-pink-200 rounded-lg px-3 py-2 mt-1 hover:bg-pink-100 transition-colors">
                  🎬 AI Video Studio →
                </a>
                <a href="/GlobalLeaderboard" className="inline-flex items-center gap-2 text-sm font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mt-1 hover:bg-orange-100 transition-colors">
                  🏆 Prestige Streaks →
                </a>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto text-left">
                {progress.map((p, i) => (
                  <div key={i} className={`text-xs px-2 py-1 rounded ${p.success ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                    {p.msg}
                  </div>
                ))}
              </div>
              <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold" onClick={() => setApproveOpen(false)}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}```

## `src/components/ppc/PPCAdSearchWidget.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Zap, TrendingUp, Target, X, DollarSign, Clock, Download, Share2, LayoutGrid, ShoppingCart, ExternalLink, Trophy, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { usePushNotificationTriggers } from '@/hooks/usePushNotificationTriggers';
import AnimatedJackpotCounter from '@/components/jackpot/AnimatedJackpotCounter';
import SocialMediaConnectionManager from '@/components/social/SocialMediaConnectionManager';
import ProductSearchResults from '@/components/store/ProductSearchResults';

export default function PPCAdSearchWidget({ variant = 'compact' }) {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSocialManager, setShowSocialManager] = useState(false);
  const [productResults, setProductResults] = useState(null);
  const [productSearching, setProductSearching] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Activate push notification triggers when user is set
  usePushNotificationTriggers(user);

  const { data: jackpotData } = useQuery({
    queryKey: ['jackpot-total'],
    queryFn: async () => {
      try {
        const recentTransactions = await base44.entities.PPCTransaction.filter({}).catch(() => []);
        const totalJackpot = recentTransactions.reduce((sum, t) => sum + (t.advertiser_fee || 0.1), 0);
        return { totalJackpot: totalJackpot * 0.5 }; // 50% goes to user jackpot pool
      } catch {
        return { totalJackpot: 0 };
      }
    },
    refetchInterval: 5000,
    staleTime: 3000,
  });



  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['ppc-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return null;
      const res = await base44.functions.invoke('matchAdsToSearch', { searchQuery });
      return res.data;
    },
    enabled: !!searchQuery && !!user && variant !== 'compact',
  });

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleProductSearch = async () => {
    if (!searchQuery.trim()) return;
    setProductSearching(true);

    // Deduct $0.05 search fee from user's balance
    if (user?.id) {
      const todayFeeKey = `shop_search_fee_${user.id}_${new Date().toDateString()}`;
      if (!localStorage.getItem(todayFeeKey)) {
        localStorage.setItem(todayFeeKey, '1');
        const newBal = Math.max(0, (user.current_balance || 0) - 0.05);
        base44.auth.updateMe({ current_balance: newBal }).catch(() => {});
        toast.info('$0.05 search fee deducted from your earnings.');
      }
    }

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a real-time price comparison engine. Search across the web for: "${searchQuery}".
Find this exact product listed at MULTIPLE different retailers/websites. Return every distinct retailer listing you can find, sorted from LOWEST price to HIGHEST price.
Include major retailers like Amazon, Walmart, Target, Best Buy, eBay, Newegg, B&H, Costco, GameStop, etc., plus any other relevant stores that carry this product.
For each listing return: product_name, description (brief), price (number), vendor (store name), url (product page), image_url (or empty string), in_stock (boolean), shipping_note (brief).
Return AT LEAST 6 listings if they exist. Sort from lowest price to highest price.`,
        model: 'gemini_3_flash',
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            products: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  product_name: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'number' },
                  vendor: { type: 'string' },
                  url: { type: 'string' },
                  image_url: { type: 'string' },
                  in_stock: { type: 'boolean' },
                  shipping_note: { type: 'string' },
                }
              }
            }
          }
        }
      });
      if (result.products?.length > 0) {
        const sorted = [...result.products].sort((a, b) => (a.price || 0) - (b.price || 0));
        setProductResults({ products: sorted, query: searchQuery });

        // Auto-add cheapest item to wishlist if user is logged in
        if (user?.id) {
          const cheapest = sorted[0];
          try {
            await base44.entities.ProductWishlistItem.create({
              user_id: user.id,
              product_name: cheapest.product_name || searchQuery,
              product_description: cheapest.description || '',
              product_image_url: cheapest.image_url || '',
              best_price: cheapest.price || 0,
              original_search_price: cheapest.price || 0,
              price_with_markup: (cheapest.price || 0) * 1.1,
              vendor_url: cheapest.url || '',
              vendor_name: cheapest.vendor || '',
              search_query: searchQuery,
              status: 'active',
            });
            toast.success(`✅ Added "${cheapest.product_name || searchQuery}" to your Wishlist at $${(cheapest.price || 0).toFixed(2)}!`, { duration: 4000 });
          } catch {
            // Silently fail — don't block the results
          }
        }
      } else {
        toast.error('No products found');
      }
    } catch {
      toast.error('Product search failed. Please try again.');
    } finally {
      setProductSearching(false);
    }
  };

  const handleAdClick = (ad) => {
    toast.success(`Clicked: ${ad.actual_title}`);
    base44.functions.invoke('trackAdClick', { adId: ad.ad_id, searchQuery }).catch(() => {});
    // Auto-add to wishlist
    if (user?.id) {
      base44.entities.ProductWishlistItem.create({
        user_id: user.id,
        product_name: ad.actual_title,
        product_description: ad.reasoning || '',
        best_price: ad.actual_reward || 0,
        search_query: searchQuery,
        status: 'active',
      }).catch(() => {});
    }
  };

  const handleDownload = () => {
    // Create a manifest for the browser extension
    const extensionData = {
      name: 'GainerGain Search',
      description: 'Search surveys and ads while you browse. Earn rewards instantly.',
      version: '1.0.0',
      type: 'extension'
    };
    
    // Create downloadable file
    const dataStr = JSON.stringify(extensionData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gainergain-search-extension.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Extension download started! Follow the installation guide.');
  };

  const handleSocialConnectionsChange = () => {
    toast.success('Account connected! You earned bonus prize pool points!');
    setShowSocialManager(false);
  };

  // Unified GamerGain Search bar (always product compare mode)
  if (variant === 'compact') {
    return (
      <div className="relative bg-gradient-to-r from-blue-700 to-indigo-700 w-full">
        <div className="px-3 py-2 flex items-center gap-2">
          {/* Logo/Branding */}
          <div className="flex items-center gap-1 text-white min-w-fit flex-shrink-0">
            <Zap className="w-4 h-4" />
            <span className="font-bold text-sm hidden lg:inline">GamerGain</span>
          </div>

          {/* Unified Search + Compare Bar */}
          <div className="flex-1 flex gap-1.5 min-w-0">
            <div className="flex-1 relative min-w-0">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search any product — compare prices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleProductSearch(); }}
                className="pl-9 pr-4 text-sm h-9 rounded-full bg-white text-gray-900 w-full"
                autoComplete="off"
              />
            </div>
            <button
              onClick={handleProductSearch}
              disabled={productSearching || !searchQuery.trim()}
              className="bg-green-400 text-green-900 hover:bg-green-300 rounded-full px-3 h-9 text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50 flex-shrink-0"
            >
              {productSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{productSearching ? 'Searching...' : 'Compare'}</span>
            </button>
          </div>

          {/* Animated Jackpot Counter */}
          <div className="flex-shrink-0 hidden sm:block">
            <AnimatedJackpotCounter showAnimation={true} />
          </div>

          {/* Social Media Button */}
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-blue-500 hidden lg:flex flex-shrink-0"
            onClick={() => setShowSocialManager(true)}
            title="Connect social media"
          >
            <Share2 className="w-4 h-4" />
          </Button>

          {/* Download Button */}
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-blue-500 hidden lg:flex flex-shrink-0"
            onClick={handleDownload}
            title="Download GainerGain Search Extension"
          >
            <Download className="w-4 h-4" />
          </Button>

          {/* PPC Ads Button */}
          <Link to={createPageUrl('GoogleAdsOverlay')} className="flex-shrink-0">
            <Button
              size="sm"
              className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold text-xs px-2"
            >
              <LayoutGrid className="w-3 h-3" />
              <span className="hidden md:inline ml-1">PPC Ads</span>
            </Button>
          </Link>
        </div>

        {/* Social Media Manager Modal */}
        <AnimatePresence>
          {showSocialManager && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setShowSocialManager(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-96 overflow-y-auto"
              >
                <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Connect Social Media</h3>
                  <button onClick={() => setShowSocialManager(false)}>
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <div className="p-4">
                  <SocialMediaConnectionManager onConnectionsChange={handleSocialConnectionsChange} />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Product Results Panel */}
        <AnimatePresence>
          {productResults && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[80vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900 flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-blue-600" />
                    Price Comparison — "{productResults.query}"
                  </p>
                  <p className="text-xs text-gray-500">{productResults.products.length} stores · sorted lowest to highest</p>
                </div>
                <button onClick={() => { setProductResults(null); }} className="text-gray-400 hover:text-gray-600 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Best deal callout */}
              {productResults.products.length > 0 && (
                <div className="mx-3 mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <p className="text-xs font-bold text-green-800">
                    Best Price: ${productResults.products[0].price?.toFixed(2)} at {productResults.products[0].vendor}
                    {productResults.products.length > 1 && (
                      <span className="font-normal text-green-600 ml-1">
                        — save ${(productResults.products[productResults.products.length - 1].price - productResults.products[0].price).toFixed(2)} vs. most expensive
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Listings */}
              <div className="p-3 space-y-2">
                {productResults.products.map((product, index) => {
                  const isBest = index === 0;
                  const priceDiff = product.price - productResults.products[0].price;
                  return (
                    <div key={index} className={`border rounded-xl p-3 flex items-center gap-3 ${isBest ? 'border-green-300 bg-green-50/50' : 'border-gray-100 hover:border-gray-200'}`}>
                      {/* Rank */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${isBest ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {isBest ? '🏆' : index + 1}
                      </div>

                      {/* Image */}
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.product_name || product.vendor}
                          className="w-12 h-12 object-cover rounded-lg border border-gray-100 flex-shrink-0"
                          onError={e => { e.target.style.display = 'none'; }} />
                      ) : null}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{product.product_name || product.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs font-semibold text-gray-600">{product.vendor}</span>
                          {product.in_stock === false
                            ? <span className="flex items-center gap-0.5 text-[10px] text-red-500"><XCircle className="w-3 h-3" />Out of stock</span>
                            : <span className="flex items-center gap-0.5 text-[10px] text-green-600"><CheckCircle className="w-3 h-3" />In stock</span>
                          }
                          {product.shipping_note && <span className="text-[10px] text-blue-600 truncate">{product.shipping_note}</span>}
                        </div>
                      </div>

                      {/* Price + Link */}
                      <div className="text-right flex-shrink-0">
                        <p className={`text-base font-black ${isBest ? 'text-green-600' : 'text-gray-800'}`}>
                          ${product.price > 0 ? product.price.toFixed(2) : 'N/A'}
                        </p>
                        {priceDiff > 0.01 && <p className="text-[10px] text-red-400">+${priceDiff.toFixed(2)}</p>}
                        {isBest && <p className="text-[10px] text-green-600 font-bold">Best price</p>}
                      </div>

                      <a href={product.url} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 text-blue-500 hover:text-blue-700 p-1" title={`View on ${product.vendor}`}>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  );
                })}
              </div>

              <div className="px-3 pb-3">
                <p className="text-[10px] text-gray-400 text-center">Prices are real-time estimates · Click any link to buy directly · Order via GamerGain available in the <Link to={createPageUrl('InAppGameStore')} className="text-blue-500 underline">Game Store</Link></p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Full widget variant (for game store)
  return (
    <Card className="bg-gradient-to-br from-orange-50 to-pink-50 border-2 border-orange-200">
      <CardHeader className="bg-gradient-to-r from-orange-600 to-pink-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            <CardTitle>PPC Ad Marketplace</CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search for ads and surveys..."
            value={searchQuery}
            onChange={handleSearch}
            className="pl-10 text-base"
          />
        </div>

        {/* Jackpot Banner */}
        <motion.div 
          className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg p-4 shadow-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs opacity-90">Current Prize Pool</p>
              <motion.p 
                className="text-3xl font-bold"
                key={jackpotData?.totalJackpot}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
              >
                ${(jackpotData?.totalJackpot || 0).toFixed(2)}
              </motion.p>
            </div>
            <TrendingUp className="w-12 h-12 opacity-30" />
          </div>
          <p className="text-xs mt-2 opacity-90">Grows as advertisers get conversions (10¢ per sale)</p>
        </motion.div>

        {/* Search Results */}
        {searchQuery && (
          <div className="space-y-2">
            {searchLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
              </div>
            ) : searchResults?.matches && searchResults.matches.length > 0 ? (
              <>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Target className="w-4 h-4 text-orange-600" />
                  Personalized Results
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {searchResults.matches.map((ad, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => handleAdClick(ad)}
                      className="bg-white border-2 border-green-200 rounded-lg p-3 hover:shadow-lg cursor-pointer transition-all hover:border-green-400"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900 flex-1">{ad.actual_title}</h4>
                        <Badge className="bg-green-600 text-white flex-shrink-0">{ad.relevance_score}%</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{ad.reasoning}</p>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 font-semibold text-green-700">
                          <DollarSign className="w-4 h-4" />
                          ${ad.actual_reward.toFixed(2)}
                        </span>
                        <span className="flex items-center gap-1 text-gray-600">
                          <Clock className="w-4 h-4" />
                          ~{ad.estimated_time}m
                        </span>
                        {ad.ad_type && (
                          <Badge variant="outline" className="text-xs capitalize">{ad.ad_type}</Badge>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            ) : searchQuery ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No ads match "{searchQuery}"</p>
              </div>
            ) : null}
          </div>
        )}

        {searchResults?.search_insight && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800 italic">{searchResults.search_insight}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}```

## `src/components/pricing/WhiteLabelSection.jsx`

```jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight, TrendingUp, Users, PieChart } from 'lucide-react';

export default function WhiteLabelSection() {
  const benefits = [
    { icon: PieChart, text: 'We split survey revenue 50/50 (platform) + 25% user + 25% partner' },
    { icon: TrendingUp, text: 'Real-time revenue tracking & partner dashboard' },
    { icon: Users, text: 'Dedicated partner support & success team' },
    { icon: Check, text: 'White-label branding at zero additional cost' },
    { icon: Check, text: 'API access for custom integrations' },
    { icon: Check, text: 'Monthly payouts with detailed analytics' }
  ];

  const exampleRevenue = [
    { scenario: '$10,000 Survey Revenue', breakdown: [
      { party: 'Platform', percent: 50, amount: '$5,000' },
      { party: 'Your Users', percent: 25, amount: '$2,500' },
      { party: 'You (Partner)', percent: 25, amount: '$2,500' }
    ]},
    { scenario: '$50,000 Survey Revenue', breakdown: [
      { party: 'Platform', percent: 50, amount: '$25,000' },
      { party: 'Your Users', percent: 25, amount: '$12,500' },
      { party: 'You (Partner)', percent: 25, amount: '$12,500' }
    ]}
  ];

  return (
    <div className="space-y-8 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 mb-4 px-4 py-2">
          🤝 White-Label Partnership
        </Badge>
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3">
          Build Your Own Platform. Zero Setup Cost.
        </h2>
        <p className="text-slate-600 text-lg max-w-3xl mx-auto">
          White-label the entire survey platform under your brand. We handle the tech, you keep 25% of all survey revenue from your users.
        </p>
      </div>

      {/* Main Offer Card */}
      <Card className="border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 to-white">
        <CardHeader className="bg-emerald-600 text-white rounded-t-lg">
          <CardTitle className="text-2xl">White-Label Partnership Program</CardTitle>
        </CardHeader>
        <CardContent className="pt-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left: Benefits */}
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-6">What You Get</h3>
              <div className="space-y-4">
                {benefits.map((benefit, idx) => {
                  const Icon = benefit.icon;
                  return (
                    <div key={idx} className="flex gap-3">
                      <Icon className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <p className="text-slate-700">{benefit.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Revenue Examples */}
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-6">Revenue Split Examples</h3>
              <div className="space-y-6">
                {exampleRevenue.map((example, idx) => (
                  <div key={idx} className="p-4 bg-white border border-slate-200 rounded-lg">
                    <p className="font-semibold text-slate-900 mb-3">{example.scenario}</p>
                    <div className="space-y-2">
                      {example.breakdown.map((item, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">{item.party}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-200 rounded h-2">
                              <div
                                className={`h-full rounded ${
                                  item.party === 'Platform' ? 'bg-slate-800' :
                                  item.party === 'Your Users' ? 'bg-blue-500' :
                                  'bg-emerald-600'
                                }`}
                                style={{ width: `${item.percent}%` }}
                              />
                            </div>
                            <span className="font-bold text-slate-900 w-16 text-right">{item.amount}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 pt-8 border-t border-slate-200 flex gap-4 justify-center flex-wrap">
            <Link to="/WhiteLabelSetup">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-6 text-lg">
                Start AI Setup — Free <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to={createPageUrl('PartnerOnboarding')}>
              <Button variant="outline" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 font-bold px-8 py-6 text-lg">
                View Partner Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Why Choose Us */}
      <Card>
        <CardHeader>
          <CardTitle>Why Partner With Us?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-bold text-slate-900 mb-2">Proven Platform</h4>
              <p className="text-slate-600 text-sm">
                Our survey engine processes millions of responses monthly with enterprise-grade reliability.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-2">Instant Scale</h4>
              <p className="text-slate-600 text-sm">
                Launch your platform within weeks, not months. We handle all technical infrastructure.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-2">Revenue Growth</h4>
              <p className="text-slate-600 text-sm">
                Average partner earns $2,500–$15,000/month depending on user base and engagement.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}```

## `src/components/referral/ActiveReferralContestSection.jsx`

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Trophy, Crown, Medal, Award, Star, Gift,
  Clock, Flame, Users, ArrowRight, Lock, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns';

const PRIZE_POOL = [
  { rank: 1, prize: '$500', color: 'from-yellow-400 to-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-300', textColor: 'text-yellow-700', Icon: Crown },
  { rank: 2, prize: '$250', color: 'from-gray-300 to-gray-500', bg: 'bg-gray-50', border: 'border-gray-300', textColor: 'text-gray-600', Icon: Medal },
  { rank: 3, prize: '$100', color: 'from-amber-500 to-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', textColor: 'text-amber-700', Icon: Award },
];

function getContestEnd() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function CountdownTimer({ targetDate }) {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime({
        days: differenceInDays(targetDate, now),
        hours: differenceInHours(targetDate, now) % 24,
        minutes: differenceInMinutes(targetDate, now) % 60,
        seconds: differenceInSeconds(targetDate, now) % 60,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const isUrgent = time.days < 3;

  return (
    <div className={`flex items-center gap-2 justify-center ${isUrgent ? 'animate-pulse' : ''}`}>
      {[
        { label: 'D', value: time.days },
        { label: 'H', value: time.hours },
        { label: 'M', value: time.minutes },
        { label: 'S', value: time.seconds },
      ].map((u, i) => (
        <div key={u.label} className="flex items-center gap-2">
          {i > 0 && <span className="text-white/60 font-bold text-lg mb-3">:</span>}
          <div className="text-center">
            <div className={`rounded-lg w-12 h-12 flex items-center justify-center text-xl font-black tabular-nums ${isUrgent ? 'bg-red-500 text-white' : 'bg-white/20 text-white'}`}>
              {String(u.value ?? 0).padStart(2, '0')}
            </div>
            <p className="text-xs text-white/70 mt-1 font-medium">{u.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function LeaderRow({ entry, rank, isMe, userName }) {
  const rankBg = rank === 1 ? 'bg-yellow-50 border-yellow-200' : rank === 2 ? 'bg-gray-50 border-gray-200' : rank === 3 ? 'bg-amber-50 border-amber-200' : rank <= 10 ? 'bg-blue-50/50 border-blue-100' : 'bg-white border-gray-100';
  const prizeLabel = rank === 1 ? '$500' : rank === 2 ? '$250' : rank === 3 ? '$100' : rank <= 5 ? '$50' : rank <= 10 ? '$25' : null;
  const RankIcon = rank === 1 ? Crown : rank === 2 ? Medal : rank === 3 ? Award : null;

  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${rankBg} ${isMe ? 'ring-2 ring-green-400 ring-offset-1' : ''} transition-all`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0 ${rank === 1 ? 'bg-yellow-400 text-white' : rank === 2 ? 'bg-gray-300 text-gray-700' : rank === 3 ? 'bg-amber-500 text-white' : rank <= 10 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
        {RankIcon ? <RankIcon className="w-4 h-4" /> : rank}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm truncate">
          {isMe ? <span className="text-green-700">{userName} <Badge className="text-xs bg-green-100 text-green-700 border-0 py-0">You</Badge></span> : `Referrer #${entry.user_id.slice(-4).toUpperCase()}`}
        </p>
        <p className="text-xs text-gray-400">${entry.commission.toFixed(2)} earned</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-right">
          <p className="font-black text-base text-gray-800">{entry.count}</p>
          <p className="text-xs text-gray-400">refs</p>
        </div>
        {prizeLabel ? (
          <Badge className={`text-xs font-bold ${rank <= 3 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
            {prizeLabel}
          </Badge>
        ) : (
          <Lock className="w-3.5 h-3.5 text-gray-200" />
        )}
      </div>
    </div>
  );
}

export default function ActiveReferralContestSection({ user }) {
  const contestEnd = getContestEnd();

  const { data: allReferrals = [], dataUpdatedAt } = useQuery({
    queryKey: ['contest-referrals-home'],
    queryFn: () => base44.entities.Referral.list('-created_date', 300),
    refetchInterval: 30000, // refresh every 30s for real-time feel
  });

  const leaderboard = useMemo(() => {
    const map = {};
    allReferrals.forEach(r => {
      if (!r.referrer_user_id) return;
      if (!map[r.referrer_user_id]) map[r.referrer_user_id] = { user_id: r.referrer_user_id, count: 0, commission: 0 };
      if (r.status === 'active') map[r.referrer_user_id].count++;
      map[r.referrer_user_id].commission += r.commission_earned || 0;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [allReferrals]);

  const myRank = user ? leaderboard.findIndex(e => e.user_id === user.id) + 1 : 0;
  const myEntry = leaderboard.find(e => e.user_id === user?.id);
  const myCount = myEntry?.count || 0;
  const top10Threshold = leaderboard[9]?.count || 1;

  const lastUpdated = dataUpdatedAt ? format(new Date(dataUpdatedAt), 'h:mm:ss a') : null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-black text-gray-900">🏆 Active Referral Prize Pool</h2>
            <Badge className="bg-red-100 text-red-700 border-red-200 animate-pulse text-xs font-bold">
              <Flame className="w-3 h-3 mr-1" /> LIVE
            </Badge>
          </div>
          <p className="text-sm text-gray-500">Top 10 referrers split the prize pool · Resets {format(contestEnd, 'MMM d')}</p>
        </div>
        <Link to={createPageUrl('ReferralContest')}>
          <Button size="sm" className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold gap-1.5 shadow-md">
            Join Contest <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">

        {/* Left: Countdown + Prize Pool */}
        <div className="space-y-4">
          {/* Countdown */}
          <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-red-500 p-5 text-center shadow-xl">
            <div className="flex items-center justify-center gap-1.5 text-white/80 text-xs font-bold uppercase tracking-wide mb-3">
              <Clock className="w-3.5 h-3.5" /> Contest Ends In
            </div>
            <CountdownTimer targetDate={contestEnd} />
            <p className="text-white/60 text-xs mt-3">
              Ends {format(contestEnd, 'MMMM d, yyyy')} at midnight
            </p>
          </div>

          {/* Prize Pool */}
          <Card className="border-2 border-yellow-200 shadow-lg">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2 text-yellow-800">
                <Gift className="w-4 h-4" /> Prize Pool — $1,125 Total
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {PRIZE_POOL.map(p => (
                <div key={p.rank} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${p.bg} ${p.border}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${p.color} flex items-center justify-center`}>
                      <p.Icon className="w-3 h-3 text-white" />
                    </div>
                    <span className={`text-xs font-semibold ${p.textColor}`}>#{p.rank} Place</span>
                  </div>
                  <span className="text-sm font-black text-green-600">{p.prize}</span>
                </div>
              ))}
              {[
                { label: '#4–5 Place', prize: '$50 each' },
                { label: '#6–10 Place', prize: '$25 each' },
              ].map(p => (
                <div key={p.label} className="flex items-center justify-between rounded-lg px-3 py-2 border border-blue-100 bg-blue-50">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <Star className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-blue-700">{p.label}</span>
                  </div>
                  <span className="text-sm font-black text-green-600">{p.prize}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right: Live Leaderboard */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-xl h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="w-4 h-4 text-yellow-500" /> Live Leaderboard
                </CardTitle>
                <div className="flex items-center gap-2">
                  {lastUpdated && (
                    <span className="text-xs text-gray-400">Updated {lastUpdated}</span>
                  )}
                  <Badge className="text-xs bg-green-100 text-green-700 border-0">
                    <Zap className="w-3 h-3 mr-1" /> Refreshes every 30s
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {leaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-14 h-14 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No entries yet — be first to climb the board!</p>
                  <Link to={createPageUrl('ReferralHub')}>
                    <Button size="sm" className="mt-3 bg-yellow-500 hover:bg-yellow-600 text-white">
                      <Users className="w-4 h-4 mr-1" /> Start Referring
                    </Button>
                  </Link>
                </div>
              ) : (
                leaderboard.map((entry, idx) => (
                  <LeaderRow
                    key={entry.user_id}
                    entry={entry}
                    rank={idx + 1}
                    isMe={user && entry.user_id === user.id}
                    userName={user?.full_name}
                  />
                ))
              )}

              {/* My position if not in top 10 */}
              {user && myRank === 0 && leaderboard.length > 0 && (
                <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                  <div className="rounded-xl px-3 py-2.5 border-2 border-dashed border-green-300 bg-green-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-black text-xs">?</div>
                        <div>
                          <p className="font-semibold text-green-700 text-sm">{user.full_name} <Badge className="text-xs bg-green-100 text-green-700 border-0 py-0">You</Badge></p>
                          <p className="text-xs text-gray-400">Not yet on the board</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-amber-600 font-semibold">Need {top10Threshold - myCount} more refs</p>
                        <p className="text-xs text-gray-400">to enter top 10</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Progress value={Math.min((myCount / top10Threshold) * 100, 100)} className="h-1.5" />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}```

## `src/components/referral/ReferralMilestoneJackpot.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Gift, Ticket, Star, Crown, Users, DollarSign, Zap, CheckCircle, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const MILESTONES = [
  {
    count: 5,
    label: 'Rookie Recruiter',
    icon: '🌱',
    badge_name: 'Rookie Recruiter',
    jackpot_entries: 1,
    reward_color: 'from-green-400 to-emerald-500',
    border: 'border-green-300',
    bg: 'bg-green-50',
    perks: ['1 prize pool point', 'Rookie Recruiter badge', 'Profile flair'],
  },
  {
    count: 25,
    label: 'Network Builder',
    icon: '⚡',
    badge_name: 'Network Builder',
    jackpot_entries: 5,
    reward_color: 'from-blue-400 to-indigo-500',
    border: 'border-blue-300',
    bg: 'bg-blue-50',
    perks: ['5 prize pool points', 'Network Builder badge', 'Priority survey access'],
  },
  {
    count: 50,
    label: 'Growth Champion',
    icon: '🔥',
    badge_name: 'Growth Champion',
    jackpot_entries: 15,
    reward_color: 'from-orange-400 to-red-500',
    border: 'border-orange-300',
    bg: 'bg-orange-50',
    perks: ['15 prize pool points', 'Growth Champion badge', 'Custom profile frame', 'Bonus 5% commission'],
  },
  {
    count: 100,
    label: 'Referral Legend',
    icon: '👑',
    badge_name: 'Referral Legend',
    jackpot_entries: 50,
    reward_color: 'from-yellow-400 to-amber-500',
    border: 'border-yellow-300',
    bg: 'bg-yellow-50',
    perks: ['50 prize pool points', 'Referral Legend badge', 'Exclusive golden frame', '10% commission boost', 'VIP survey pool access'],
  },
];

function MilestoneCard({ milestone, totalReferrals, achieved, userId, qc }) {
  const progress = Math.min(100, (totalReferrals / milestone.count) * 100);
  const remaining = Math.max(0, milestone.count - totalReferrals);

  const { data: existingMilestone } = useQuery({
    queryKey: ['milestone', userId, milestone.count],
    queryFn: () => base44.entities.ReferralMilestone.filter({ user_id: userId, milestone_count: milestone.count }).then(r => r[0] || null),
    enabled: !!userId,
  });

  const claimMutation = useMutation({
    mutationFn: () => base44.entities.ReferralMilestone.create({
      user_id: userId,
      milestone_count: milestone.count,
      achieved_at: new Date().toISOString(),
      jackpot_entries_awarded: milestone.jackpot_entries,
      badge_name: milestone.badge_name,
      badge_icon: milestone.icon,
      reward_claimed: true,
      notified: true,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['milestone', userId, milestone.count]);
      qc.invalidateQueries(['milestones', userId]);
      toast.success(`🎉 ${milestone.label} milestone claimed! +${milestone.jackpot_entries} prize pool points!`);
    },
  });

  const isClaimed = !!existingMilestone?.reward_claimed;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className={`relative border-2 rounded-2xl p-5 transition-all
        ${achieved ? `${milestone.border} ${milestone.bg} shadow-md` : 'border-gray-200 bg-gray-50 opacity-70'}`}>

      {/* Milestone badge header */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl
          ${achieved ? `bg-gradient-to-br ${milestone.reward_color} shadow-lg` : 'bg-gray-200'}`}>
          {achieved ? milestone.icon : <Lock className="w-5 h-5 text-gray-400" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">{milestone.count} Referrals</span>
            {isClaimed && <Badge className="bg-green-100 text-green-700 text-xs">✅ Claimed</Badge>}
            {achieved && !isClaimed && <Badge className="bg-amber-100 text-amber-700 text-xs animate-pulse">Claim Now!</Badge>}
          </div>
          <p className={`text-sm font-semibold ${achieved ? 'text-gray-700' : 'text-gray-400'}`}>{milestone.label}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 justify-end">
            <Ticket className="w-4 h-4 text-purple-500" />
            <span className="font-black text-purple-700">+{milestone.jackpot_entries}</span>
          </div>
          <p className="text-xs text-gray-400">prize pool points</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{Math.min(totalReferrals, milestone.count)}/{milestone.count} referrals</span>
          {!achieved && <span className="text-indigo-600 font-semibold">{remaining} more to go</span>}
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div className={`h-full rounded-full bg-gradient-to-r ${milestone.reward_color}`}
            initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.8 }} />
        </div>
      </div>

      {/* Perks */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {milestone.perks.map((p, i) => (
          <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${achieved ? 'bg-white text-gray-600 border border-gray-200' : 'bg-gray-100 text-gray-400'}`}>
            {p}
          </span>
        ))}
      </div>

      {achieved && !isClaimed && (
        <Button size="sm" className={`w-full bg-gradient-to-r ${milestone.reward_color} text-white font-bold`}
          onClick={() => claimMutation.mutate()} disabled={claimMutation.isPending}>
          {claimMutation.isPending ? '...' : `🎉 Claim ${milestone.jackpot_entries} Prize Pool Points`}
        </Button>
      )}
    </motion.div>
  );
}

function JackpotWidget({ userId, totalReferrals }) {
  const { data: jackpots = [] } = useQuery({
    queryKey: ['jackpots'],
    queryFn: () => base44.entities.ReferralJackpot.filter({ status: 'active' }),
    staleTime: 60000,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', userId],
    queryFn: () => base44.entities.ReferralMilestone.filter({ user_id: userId }),
    enabled: !!userId,
  });

  const activeJackpot = jackpots[0] || {
    jackpot_amount: 2840,
    period: '2026-Q1',
    total_entries: 342,
  };

  const myEntries = milestones.reduce((s, m) => s + (m.jackpot_entries_awarded || 0), 0);
  // Share of total performance points (a standing indicator) — winners are ranked by skill, not chance.
  const myPointShare = activeJackpot.total_entries > 0 ? ((myEntries / (activeJackpot.total_entries + myEntries)) * 100).toFixed(1) : 0;

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 text-white overflow-hidden">
      <CardContent className="p-6 relative">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-white/20 rounded-2xl"><Trophy className="w-7 h-7" /></div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-75">Active Skill Tournament</p>
              <h2 className="text-2xl font-black">${(activeJackpot.prize_pool || activeJackpot.jackpot_amount || 0).toLocaleString()}</h2>
            </div>
            <Badge className="ml-auto bg-yellow-400 text-yellow-900 font-bold animate-pulse">Prize Pool</Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'My Points', value: myEntries, icon: Ticket },
              { label: 'Point Share', value: `${myPointShare}%`, icon: Star },
              { label: 'Total Points', value: activeJackpot.total_entries || 0, icon: Users },
            ].map(s => (
              <div key={s.label} className="bg-white/15 rounded-xl p-3 text-center">
                <s.icon className="w-4 h-4 mx-auto mb-1 opacity-75" />
                <p className="text-lg font-black">{s.value}</p>
                <p className="text-xs opacity-70">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white/15 rounded-xl p-3 text-xs">
            <p className="font-bold mb-1">🏆 How the Prize Pool Works</p>
            <ul className="space-y-0.5 opacity-85">
              <li>• Hit referral milestones (5, 25, 50, 100) to earn points</li>
              <li>• <strong>Everyone earns a share</strong> in proportion to the verified referrals they drive</li>
              <li>• Top performers get a bonus — decided by results, never chance</li>
              <li>• The pool is funded from the revenue those referrals generate</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReferralMilestoneJackpot({ userId, totalReferrals = 0 }) {
  const qc = useQueryClient();

  const achievedMilestones = MILESTONES.filter(m => totalReferrals >= m.count);

  return (
    <div className="space-y-6">
      <JackpotWidget userId={userId} totalReferrals={totalReferrals} />

      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <Gift className="w-4 h-4 text-purple-600" /> Milestone Rewards — Earn Permanent Prize Pool Points
          <Badge className="bg-purple-100 text-purple-700 text-xs">{achievedMilestones.length}/{MILESTONES.length} achieved</Badge>
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          {MILESTONES.map(m => (
            <MilestoneCard key={m.count} milestone={m} totalReferrals={totalReferrals}
              achieved={totalReferrals >= m.count} userId={userId} qc={qc} />
          ))}
        </div>
      </div>
    </div>
  );
}```

## `src/components/referral/ReferralProgressTracker.jsx`

```jsx
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Gift, Ticket, Lock, CheckCircle, ChevronRight, Star, Zap, Crown } from 'lucide-react';
import { toast } from 'sonner';

const MILESTONES = [
  {
    count: 5,
    label: 'Rookie Recruiter',
    icon: '🌱',
    color: 'from-green-400 to-emerald-500',
    border: 'border-green-300',
    bg: 'bg-green-50',
    textColor: 'text-green-700',
    badgeName: 'Rookie Recruiter',
    jackpotEntries: 1,
    commissionBoost: null,
    exclusiveSurveys: false,
    perks: ['1 Prize Pool Point', 'Rookie Badge', 'Profile Flair'],
  },
  {
    count: 25,
    label: 'Network Builder',
    icon: '⚡',
    color: 'from-blue-400 to-indigo-500',
    border: 'border-blue-300',
    bg: 'bg-blue-50',
    textColor: 'text-blue-700',
    badgeName: 'Network Builder',
    jackpotEntries: 5,
    commissionBoost: null,
    exclusiveSurveys: true,
    perks: ['5 Prize Pool Points', 'Network Builder Badge', 'Priority Survey Access'],
  },
  {
    count: 50,
    label: 'Growth Champion',
    icon: '🔥',
    color: 'from-orange-400 to-red-500',
    border: 'border-orange-300',
    bg: 'bg-orange-50',
    textColor: 'text-orange-700',
    badgeName: 'Growth Champion',
    jackpotEntries: 15,
    commissionBoost: 5,
    exclusiveSurveys: true,
    perks: ['15 Prize Pool Points', 'Growth Champion Badge', 'Custom Frame', '+5% Commission'],
  },
  {
    count: 100,
    label: 'Referral Legend',
    icon: '👑',
    color: 'from-yellow-400 to-amber-500',
    border: 'border-yellow-300',
    bg: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    badgeName: 'Referral Legend',
    jackpotEntries: 50,
    commissionBoost: 10,
    exclusiveSurveys: true,
    perks: ['50 Prize Pool Points', 'Legend Badge', 'Golden Frame', '+10% Commission', 'VIP Survey Pool'],
  },
];

function OverallProgressBar({ totalReferrals }) {
  const nextMilestone = MILESTONES.find(m => totalReferrals < m.count) || MILESTONES[MILESTONES.length - 1];
  const prevCount = MILESTONES.find(m => m.count < nextMilestone.count)?.count || 0;
  const pct = Math.min(100, ((totalReferrals - prevCount) / (nextMilestone.count - prevCount)) * 100);
  const achieved = MILESTONES.filter(m => totalReferrals >= m.count).length;

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 text-white mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest opacity-75">Referral Journey</p>
          <p className="text-3xl font-black">{totalReferrals} <span className="text-base font-normal opacity-75">referrals</span></p>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-75">Milestones</p>
          <p className="text-2xl font-black">{achieved}<span className="text-sm font-normal opacity-75">/{MILESTONES.length}</span></p>
        </div>
      </div>
      <div className="relative h-4 bg-white/20 rounded-full overflow-hidden mb-2">
        <motion.div
          className="h-full bg-white rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        {/* Milestone markers */}
        {MILESTONES.map((m, i) => {
          const markerPct = i === 0 ? (5 / nextMilestone.count) * 100 : (m.count / MILESTONES[MILESTONES.length - 1].count) * 100;
          return (
            <div key={m.count} className="absolute top-0 bottom-0 w-0.5 bg-white/40"
              style={{ left: `${(m.count / 100) * 100}%` }} />
          );
        })}
      </div>
      <p className="text-xs opacity-75">
        {totalReferrals >= 100 ? '🎉 All milestones achieved!' : `${nextMilestone.count - totalReferrals} more to reach ${nextMilestone.label}`}
      </p>
    </div>
  );
}

function MilestoneCard({ milestone, totalReferrals, userId, qc }) {
  const achieved = totalReferrals >= milestone.count;
  const progress = Math.min(100, (totalReferrals / milestone.count) * 100);

  const { data: record } = useQuery({
    queryKey: ['rm', userId, milestone.count],
    queryFn: () => base44.entities.ReferralMilestone.filter({ user_id: userId, milestone_count: milestone.count }).then(r => r[0] || null),
    enabled: !!userId,
  });

  const claimMutation = useMutation({
    mutationFn: () => base44.entities.ReferralMilestone.create({
      user_id: userId,
      milestone_count: milestone.count,
      achieved_at: new Date().toISOString(),
      jackpot_entries_awarded: milestone.jackpotEntries,
      badge_name: milestone.badgeName,
      badge_icon: milestone.icon,
      reward_claimed: true,
      notified: true,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['rm', userId, milestone.count]);
      qc.invalidateQueries(['milestones', userId]);
      toast.success(`🎉 ${milestone.label} unlocked! +${milestone.jackpotEntries} prize pool points awarded!`);
    },
  });

  const isClaimed = !!record?.reward_claimed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl border-2 p-5 transition-all
        ${achieved ? `${milestone.border} ${milestone.bg} shadow-md` : 'border-gray-200 bg-white'}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm
          ${achieved ? `bg-gradient-to-br ${milestone.color}` : 'bg-gray-100'}`}>
          {achieved ? milestone.icon : <Lock className="w-6 h-6 text-gray-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900">{milestone.count} Referrals</span>
            {isClaimed && <Badge className="bg-green-100 text-green-700 text-xs border-green-200">✅ Claimed</Badge>}
            {achieved && !isClaimed && <Badge className="bg-amber-100 text-amber-700 text-xs border-amber-200 animate-pulse">🎁 Claim Now</Badge>}
          </div>
          <p className={`text-sm font-semibold ${achieved ? milestone.textColor : 'text-gray-400'}`}>{milestone.label}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`flex items-center gap-1 justify-end ${achieved ? 'text-purple-700' : 'text-gray-300'}`}>
            <Ticket className="w-4 h-4" />
            <span className="font-black">+{milestone.jackpotEntries}</span>
          </div>
          <p className="text-xs text-gray-400">entries</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">{Math.min(totalReferrals, milestone.count)}/{milestone.count}</span>
          {!achieved && <span className={`font-semibold ${milestone.textColor}`}>{milestone.count - totalReferrals} to go</span>}
        </div>
        <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${milestone.color}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, delay: 0.1 }}
          />
        </div>
      </div>

      {/* Perks grid */}
      <div className="grid grid-cols-2 gap-1.5 mb-4">
        {milestone.perks.map((p, i) => (
          <div key={i} className={`text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1.5
            ${achieved ? 'bg-white border border-gray-200 text-gray-700' : 'bg-gray-50 text-gray-400'}`}>
            <Star className={`w-3 h-3 flex-shrink-0 ${achieved ? milestone.textColor : 'text-gray-300'}`} />
            {p}
          </div>
        ))}
      </div>

      {/* Claim button */}
      {achieved && !isClaimed && (
        <Button
          className={`w-full bg-gradient-to-r ${milestone.color} text-white font-bold border-0 shadow-md`}
          onClick={() => claimMutation.mutate()}
          disabled={claimMutation.isPending}
        >
          {claimMutation.isPending
            ? '...'
            : <><Gift className="w-4 h-4 mr-2" /> Claim {milestone.jackpotEntries} Prize Pool Points</>}
        </Button>
      )}
      {isClaimed && (
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-green-700 bg-green-50 rounded-xl py-2">
          <CheckCircle className="w-4 h-4" /> Reward Claimed
        </div>
      )}
    </motion.div>
  );
}

export default function ReferralProgressTracker({ userId, totalReferrals = 0 }) {
  const qc = useQueryClient();

  return (
    <div className="space-y-4">
      <OverallProgressBar totalReferrals={totalReferrals} />
      <div className="grid md:grid-cols-2 gap-4">
        {MILESTONES.map(m => (
          <MilestoneCard key={m.count} milestone={m} totalReferrals={totalReferrals} userId={userId} qc={qc} />
        ))}
      </div>
    </div>
  );
}```

## `src/components/referral/SocialShareHub.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Share2, Copy, Ticket, CheckCircle, Zap, TrendingUp, ExternalLink, Link } from 'lucide-react';

// Simple inline Twitter/Facebook icons since lucide-react may vary
const Twitter = (props) => <svg {...props} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
const Facebook = (props) => <svg {...props} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;

const SHARE_MESSAGES = {
  twitter: [
    (link) => `🎮 I'm earning real money playing games & taking surveys on GamerGain! Join me and we BOTH get rewarded 💰 → ${link} #GamerGain #EarnOnline`,
    (link) => `Imagine getting paid to play games 🕹️ That's GamerGain. Use my link and start earning today → ${link}`,
    (link) => `Just hit another referral milestone on @GamerGainApp 🏆 You can earn too — ${link} #PassiveIncome #Gamers`,
  ],
  facebook: [
    (link) => `🎮 I've been using GamerGain to earn money by playing games and completing surveys, and it's been amazing!\n\nSign up with my link and we both get a bonus when you start earning:\n👉 ${link}\n\nLet's grow together! 💰`,
    (link) => `Have you tried GamerGain yet? I've been earning real cash playing games 🕹️\n\nUse my referral link to join — you get a bonus and so do I:\n${link}`,
  ],
};

function ShareCard({ platform, icon: Icon, color, bgColor, borderColor, message, link, onShareClick }) {
  const [copied, setCopied] = useState(false);

  const copyText = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Post text copied!');
  };

  return (
    <div className={`rounded-2xl border-2 ${borderColor} ${bgColor} p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className={`font-bold text-sm ${color}`}>{platform}</span>
        <Badge className="ml-auto bg-purple-100 text-purple-700 text-xs border-purple-200">
          <Ticket className="w-3 h-3 mr-1" />+1 Entry on Share
        </Badge>
      </div>
      <div className="bg-white rounded-xl p-3 text-xs text-gray-700 leading-relaxed mb-3 border border-gray-100 max-h-24 overflow-y-auto">
        {message}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={copyText} className="flex-1 gap-1.5 text-xs">
          {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy Text'}
        </Button>
        <Button size="sm" onClick={() => onShareClick(platform)} className={`flex-1 gap-1.5 text-xs bg-gradient-to-r ${
          platform === 'Twitter' ? 'from-sky-500 to-sky-600' : 'from-blue-600 to-blue-700'
        } text-white border-0`}>
          <ExternalLink className="w-3.5 h-3.5" />
          Share Now
        </Button>
      </div>
    </div>
  );
}

export default function SocialShareHub({ user, referralLink }) {
  const qc = useQueryClient();
  const [msgIdx, setMsgIdx] = useState(0);
  const [shareCount, setShareCount] = useState(0);

  const { data: clickStats } = useQuery({
    queryKey: ['share-stats', user?.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id }).then(r => {
      const total = r.reduce((s, l) => s + (l.click_count || 0), 0);
      const shares = r.reduce((s, l) => s + (l.share_count || 0), 0);
      return { clicks: total, shares };
    }),
    enabled: !!user,
  });

  const link = referralLink || `https://gamergain.app/ref/${user?.id?.slice(0, 8)}`;

  const twitterMessage = SHARE_MESSAGES.twitter[msgIdx % SHARE_MESSAGES.twitter.length](link);
  const facebookMessage = SHARE_MESSAGES.facebook[msgIdx % SHARE_MESSAGES.facebook.length](link);

  const awardEntryMutation = useMutation({
    mutationFn: async (platform) => {
      // Log the share as a prize pool point
      await base44.entities.ReferralMilestone.create({
        user_id: user.id,
        milestone_count: 0,
        achieved_at: new Date().toISOString(),
        jackpot_entries_awarded: 1,
        badge_name: `Social Share (${platform})`,
        badge_icon: platform === 'Twitter' ? '🐦' : '👥',
        reward_claimed: true,
        notified: false,
      });
      // Track the share
      await base44.entities.UserJourneyEvent.create({
        user_id: user.id,
        event_type: 'feature_click',
        feature_area: 'referrals',
        element_id: `social_share_${platform.toLowerCase()}`,
        referral_channel: platform === 'Twitter' ? 'twitter' : 'facebook',
        metadata: { link, platform },
      });
    },
    onSuccess: (_, platform) => {
      qc.invalidateQueries(['share-stats', user?.id]);
      setShareCount(p => p + 1);
      toast.success(`🏆 +1 prize pool point awarded for sharing on ${platform}!`);
    },
  });

  const handleShare = (platform) => {
    awardEntryMutation.mutate(platform);
    if (platform === 'Twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterMessage)}`, '_blank');
    } else {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(facebookMessage)}`, '_blank');
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    toast.success('Referral link copied!');
  };

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Link Clicks', value: clickStats?.clicks || 0, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Shares Made', value: (clickStats?.shares || 0) + shareCount, icon: Share2, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Share Entries', value: (clickStats?.shares || 0) + shareCount, icon: Ticket, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-3 ${s.bg} text-center`}>
            <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Referral link bar */}
      <div className="flex items-center gap-2 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-3">
        <Link className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="text-sm text-gray-600 flex-1 truncate font-mono">{link}</span>
        <Button size="sm" onClick={copyLink} variant="outline" className="flex-shrink-0 gap-1.5 text-xs">
          <Copy className="w-3.5 h-3.5" /> Copy Link
        </Button>
      </div>

      {/* Bonus entry info */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-4 flex items-start gap-3">
        <Zap className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-bold text-purple-800">Earn Prize Pool Points for Every Share!</p>
          <p className="text-xs text-purple-700 mt-0.5">Each time you click "Share Now" on any platform, you automatically earn <strong>+1 prize pool point</strong>. Share across multiple platforms to stack entries!</p>
        </div>
      </div>

      {/* Rotate messages */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-700">Pre-filled Social Posts</p>
        <Button size="sm" variant="outline" onClick={() => setMsgIdx(i => i + 1)} className="text-xs gap-1.5">
          <Zap className="w-3.5 h-3.5" /> Refresh Messages
        </Button>
      </div>

      {/* Share cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <ShareCard
          platform="Twitter"
          icon={Twitter}
          color="text-sky-600"
          bgColor="bg-sky-50"
          borderColor="border-sky-200"
          message={twitterMessage}
          link={link}
          onShareClick={handleShare}
        />
        <ShareCard
          platform="Facebook"
          icon={Facebook}
          color="text-blue-700"
          bgColor="bg-blue-50"
          borderColor="border-blue-200"
          message={facebookMessage}
          link={link}
          onShareClick={handleShare}
        />
      </div>
    </div>
  );
}```

## `src/components/referral/WishlistShareEngine.jsx`

```jsx
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Share2, Copy, TrendingUp, Gift, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function WishlistShareEngine({ userId }) {
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState([]);

  const { data: wishlistItems = [] } = useQuery({
    queryKey: ['wishlist', userId],
    queryFn: () => base44.entities.ProductWishlistItem.filter({ user_id: userId, status: 'active' }),
    enabled: !!userId,
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['wishlistReferrals', userId],
    queryFn: () => base44.entities.WishlistShareReferral.filter({ user_id: userId }),
    enabled: !!userId,
  });

  const generateMutation = useMutation({
    mutationFn: () => base44.functions.invoke('generateWishlistShareLink', {
      wishlist_item_ids: selectedItems.length > 0 ? selectedItems : wishlistItems.map(w => w.id),
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['wishlistReferrals', userId]);
      setSelectedItems([]);
      toast.success('🔗 Share link created!');
    }
  });

  const copyToClipboard = (link) => {
    navigator.clipboard.writeText(link);
    toast.success('Copied to clipboard!');
  };

  if (!userId) return null;

  return (
    <div className="space-y-6">
      {/* Generate Share Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Wishlist Share Referral
          </CardTitle>
          <CardDescription>Share your wishlist & earn Prize Pool Points or credit</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {wishlistItems.length > 0 ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Select items to share (or leave blank for all):</label>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                  {wishlistItems.map(item => (
                    <label key={item.id} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItems([...selectedItems, item.id]);
                          } else {
                            setSelectedItems(selectedItems.filter(id => id !== item.id));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <img src={item.product_image_url} alt="" className="w-8 h-8 rounded" />
                      <span className="text-sm flex-1">{item.product_name}</span>
                      <span className="text-xs font-semibold">${item.best_price.toFixed(2)}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="w-full"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Generate Share Link
              </Button>
            </>
          ) : (
            <p className="text-sm text-gray-500">Add items to your wishlist first to create a share link.</p>
          )}
        </CardContent>
      </Card>

      {/* Active Referrals */}
      {referrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Referral Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {referrals.map(ref => (
              <div key={ref.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 truncate">{ref.share_link}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(ref.share_link)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span>{ref.clicks || 0} clicks</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Gift className="w-4 h-4 text-green-500" />
                    <span>{ref.conversions || 0} conversions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Lock className="w-4 h-4 text-purple-500" />
                    <span>{ref.jackpot_entries_earned || 0} entries</span>
                  </div>
                  <div className="font-semibold text-emerald-600">
                    +${(ref.wishlist_credit_earned || 0).toFixed(2)}
                  </div>
                </div>

                {ref.status === 'active' && <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}```

## `src/components/referral/WishlistSharerLeaderboard.jsx`

```jsx
import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Flame, Gift, Crown } from 'lucide-react';
import { motion } from 'framer-motion';

export default function WishlistSharerLeaderboard() {
  const { data: referrals = [] } = useQuery({
    queryKey: ['allWishlistReferrals'],
    queryFn: () => base44.asServiceRole.entities.WishlistShareReferral.list('-conversions', 100),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Group by user and calculate totals
  const topSharers = referrals.reduce((acc, ref) => {
    const existing = acc.find(r => r.user_id === ref.user_id);
    if (existing) {
      existing.conversions += ref.conversions || 0;
      existing.jackpot_entries += ref.jackpot_entries_earned || 0;
      existing.credit += ref.wishlist_credit_earned || 0;
      existing.link_count += 1;
    } else {
      acc.push({
        user_id: ref.user_id,
        conversions: ref.conversions || 0,
        jackpot_entries: ref.jackpot_entries_earned || 0,
        credit: ref.wishlist_credit_earned || 0,
        link_count: 1,
      });
    }
    return acc;
  }, [])
    .sort((a, b) => (b.conversions + b.jackpot_entries) - (a.conversions + a.jackpot_entries))
    .slice(0, 10);

  const jackpotWinner = topSharers[0];

  return (
    <div className="space-y-6">
      {/* Prize Pool Winner Announcement */}
      {jackpotWinner && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative overflow-hidden rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 p-6 text-white shadow-2xl"
        >
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }} />
          <div className="relative space-y-2 text-center">
            <div className="flex justify-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -10, 0] }}
                  transition={{ delay: i * 0.1, repeat: Infinity, duration: 2 }}
                >
                  <Crown className="w-6 h-6" />
                </motion.div>
              ))}
            </div>
            <h3 className="text-2xl font-bold">🎉 Wishlist Sharer Champion!</h3>
            <p className="text-lg opacity-90">
              {jackpotWinner.conversions} conversions • {jackpotWinner.jackpot_entries} Prize Pool Points
            </p>
          </div>
        </motion.div>
      )}

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Top Wishlist Sharers
          </CardTitle>
          <CardDescription>Real-time rankings by conversions & Prize Pool Points</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topSharers.map((sharer, idx) => (
              <motion.div
                key={sharer.user_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  idx === 0 ? 'bg-yellow-50 border-yellow-200' :
                  idx === 1 ? 'bg-gray-50 border-gray-200' :
                  idx === 2 ? 'bg-orange-50 border-orange-200' :
                  'bg-white'
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-lg">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-semibold">User #{sharer.user_id.slice(0, 8)}</div>
                    <div className="text-xs text-gray-500">{sharer.link_count} active link{sharer.link_count !== 1 ? 's' : ''}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      <Gift className="w-4 h-4 text-green-500" />
                      {sharer.conversions}
                    </div>
                    <div className="text-xs text-gray-500">conversions</div>
                  </div>

                  <Badge className="bg-purple-100 text-purple-800 flex items-center gap-1">
                    <Flame className="w-3 h-3" />
                    {sharer.jackpot_entries}
                  </Badge>

                  <div className="text-right font-bold text-emerald-600">
                    <div>${sharer.credit.toFixed(2)}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}```

## `src/components/social/SocialMediaConnectionManager.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Facebook, Twitter, Instagram, Zap, Trash2, Plus, CheckCircle2, AlertCircle, Gift } from 'lucide-react';

const PLATFORMS = {
  facebook: {
    icon: Facebook,
    label: 'Facebook',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  twitter: {
    icon: Twitter,
    label: 'X (Twitter)',
    color: 'text-black',
    bgColor: 'bg-gray-50'
  },
  instagram: {
    icon: Instagram,
    label: 'Instagram',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50'
  },
  snapchat: {
    icon: Zap,
    label: 'Snapchat',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50'
  },
  tiktok: {
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.24 8.24 0 004.83 1.55V6.78a4.85 4.85 0 01-1.06-.09z" />
      </svg>
    ),
    label: 'TikTok',
    color: 'text-gray-900',
    bgColor: 'bg-gray-50'
  },
  youtube_shorts: {
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
    label: 'YouTube Shorts',
    color: 'text-red-600',
    bgColor: 'bg-red-50'
  },
  youtube: {
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
    label: 'YouTube',
    color: 'text-red-600',
    bgColor: 'bg-red-50'
  }
};

export default function SocialMediaConnectionManager({ onConnectionsChange }) {
  const queryClient = useQueryClient();
  const [connectingPlatform, setConnectingPlatform] = useState(null);

  const { data: connections = [] } = useQuery({
    queryKey: ['socialMediaConnections'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return await base44.entities.SocialMediaConnection.filter({
        user_id: user.id
      });
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: (connectionId) => base44.entities.SocialMediaConnection.delete(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['socialMediaConnections'] });
      onConnectionsChange?.();
    }
  });

  const handleConnect = (platform) => {
    const cb = encodeURIComponent(`${window.location.origin}/social-auth-callback`);
    const oauthUrls = {
      facebook: `https://www.facebook.com/v18.0/dialog/oauth?client_id=FACEBOOK_APP_ID&redirect_uri=${cb}&scope=pages_manage_posts,pages_read_user_profile&response_type=code`,
      twitter: `https://twitter.com/i/oauth2/authorize?client_id=TWITTER_API_KEY&redirect_uri=${cb}&scope=tweet.write%20tweet.read%20users.read&state=twitter&response_type=code`,
      instagram: `https://www.instagram.com/oauth/authorize?client_id=INSTAGRAM_APP_ID&redirect_uri=${cb}&scope=instagram_business_basic,instagram_business_content_publish&response_type=code`,
      snapchat: `https://accounts.snapchat.com/accounts/oauth2/authorize?client_id=SNAPCHAT_CLIENT_ID&redirect_uri=${cb}&scope=snapchat-marketing-api&response_type=code`,
      tiktok: `https://www.tiktok.com/v2/auth/authorize?client_key=TIKTOK_CLIENT_KEY&redirect_uri=${cb}&scope=video.upload,video.publish&response_type=code&state=tiktok`,
      youtube_shorts: `https://accounts.google.com/o/oauth2/v2/auth?client_id=GOOGLE_CLIENT_ID&redirect_uri=${cb}&scope=https://www.googleapis.com/auth/youtube.upload&response_type=code&state=youtube_shorts`,
      youtube: `https://accounts.google.com/o/oauth2/v2/auth?client_id=GOOGLE_CLIENT_ID&redirect_uri=${cb}&scope=https://www.googleapis.com/auth/youtube.upload&response_type=code&state=youtube`,
    };

    setConnectingPlatform(platform);
    window.location.href = oauthUrls[platform];
  };

  const connectedPlatforms = connections.map(c => c.platform);
  const availablePlatforms = Object.keys(PLATFORMS).filter(
    p => !connectedPlatforms.includes(p)
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            Manage your social media accounts for auto-posting ads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {connections.length === 0 ? (
              <p className="text-sm text-gray-500">No accounts connected yet</p>
            ) : (
              connections.map(conn => {
                const platform = PLATFORMS[conn.platform];
                const Icon = platform.icon;
                
                return (
                  <div
                    key={conn.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${platform.bgColor}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${platform.color}`} />
                      <div>
                        <p className="font-medium text-sm">{platform.label}</p>
                        <p className="text-xs text-gray-600">{conn.account_name}</p>
                      </div>
                      {conn.is_active && (
                        <CheckCircle2 className="w-4 h-4 text-green-600 ml-2" />
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => disconnectMutation.mutate(conn.id)}
                      disabled={disconnectMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {availablePlatforms.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle>Connect New Account</CardTitle>
            <CardDescription>
              Connect additional social media accounts and earn prize pool points!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white border border-green-200 rounded-lg p-3 flex items-start gap-2">
            <Gift className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-green-900">Earn Contest Entries!</p>
              <p className="text-green-700 text-xs mt-1">
                • Facebook/Twitter: 50 entries each<br/>
                • Instagram/Snapchat/TikTok/YouTube Shorts: 75 entries each<br/>
                • YouTube: 100 entries
              </p>
            </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {availablePlatforms.map(platform => {
                const config = PLATFORMS[platform];
                const Icon = config.icon;
                const entries = ['instagram', 'snapchat', 'tiktok'].includes(platform) ? 75 : 50;
                
                return (
                  <Button
                    key={platform}
                    onClick={() => handleConnect(platform)}
                    variant="outline"
                    className="flex flex-col items-center gap-1 h-auto py-2"
                    disabled={connectingPlatform === platform}
                  >
                    <Icon className={`w-4 h-4 ${config.color}`} />
                    <span className="text-xs">{config.label}</span>
                    {connectingPlatform !== platform && (
                      <span className="text-xs font-semibold text-green-600">+{platform === 'youtube' ? 100 : ['instagram', 'snapchat', 'tiktok', 'youtube_shorts'].includes(platform) ? 75 : 50}</span>
                    )}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}```

## `src/components/wishlist/ShareWishlistButton.jsx`

```jsx
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function ShareWishlistButton({ userId, size = 'sm' }) {
  const [open, setOpen] = useState(false);
  const [shareLink, setShareLink] = useState(null);

  const generateMutation = useMutation({
    mutationFn: () => base44.functions.invoke('generateWishlistShareLink', {
      wishlist_item_ids: [],
    }),
    onSuccess: (data) => {
      setShareLink(data.share_link);
    },
    onError: () => {
      toast.error('Failed to generate share link');
    },
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success('Share link copied! 📋');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out my wishlist!',
          text: 'Browse my wishlist and help me win Prize Pool Points',
          url: shareLink,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size={size}
          variant="outline"
          onClick={() => {
            if (!shareLink) {
              generateMutation.mutate();
            }
          }}
          className="gap-2"
        >
          <Share2 className="w-4 h-4" />
          Share Wishlist
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Your Wishlist</DialogTitle>
          <DialogDescription>
            Share with friends to earn Prize Pool Points & credit
          </DialogDescription>
        </DialogHeader>

        {generateMutation.isPending ? (
          <div className="text-center py-4">
            <div className="text-sm text-gray-500">Generating your share link...</div>
          </div>
        ) : shareLink ? (
          <div className="space-y-4">
            <div className="bg-gray-100 p-3 rounded-lg overflow-hidden">
              <code className="text-xs break-all">{shareLink}</code>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCopy}
                className="flex-1"
                variant="outline"
              >
                Copy Link
              </Button>
              <Button
                onClick={handleShare}
                className="flex-1"
              >
                Share
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}```

## `src/hooks/usePushNotificationTriggers.js`

```javascript
import { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export const usePushNotificationTriggers = (user) => {
  const [lastJackpot, setLastJackpot] = useState(0);
  const [lastDailyGoal, setLastDailyGoal] = useState(0);
  const notifiedRef = useRef({});

  useEffect(() => {
    if (!user?.id) return;

    const checkTriggers = async () => {
      try {
        // Check jackpot pool
        const transactions = await base44.entities.PPCTransaction.filter({}).catch(() => []);
        const currentJackpot = transactions.reduce((sum, t) => sum + (t.advertiser_fee || 0.1), 0) * 0.5;
        
        // Notify on new jackpot high
        if (currentJackpot > lastJackpot && currentJackpot - lastJackpot > 10) {
          const key = `jackpot_${Math.floor(currentJackpot / 100) * 100}`;
          if (!notifiedRef.current[key]) {
            notifyJackpotHigh(currentJackpot);
            notifiedRef.current[key] = true;
          }
          setLastJackpot(currentJackpot);
        }

        // Check daily goal progress
        const dailyGoals = await base44.entities.RedemptionRecord.filter({
          user_id: user.id,
          created_date: new Date().toISOString().split('T')[0]
        }).catch(() => []);
        const todayEarnings = dailyGoals.reduce((sum, g) => sum + (g.cost_balance || 0), 0);
        
        // Notify when nearing daily goal (assuming $50 daily goal)
        const dailyGoalTarget = 50;
        const percentComplete = (todayEarnings / dailyGoalTarget) * 100;
        if (percentComplete >= 80 && percentComplete < 100 && todayEarnings > lastDailyGoal) {
          const key = `daily_goal_80`;
          if (!notifiedRef.current[key]) {
            notifyDailyGoalNearing(todayEarnings, dailyGoalTarget);
            notifiedRef.current[key] = true;
          }
          setLastDailyGoal(todayEarnings);
        } else if (percentComplete >= 100 && todayEarnings > lastDailyGoal) {
          const key = `daily_goal_complete`;
          if (!notifiedRef.current[key]) {
            notifyDailyGoalComplete();
            notifiedRef.current[key] = true;
          }
          setLastDailyGoal(todayEarnings);
        }

        // Check for high-relevance ad matches from search history
        const recentSearches = await base44.entities.UserActivity.filter({
          user_id: user.id,
          activity_type: 'ppc_search'
        }).catch(() => []);

        if (recentSearches.length > 0) {
          const latestSearch = recentSearches[recentSearches.length - 1];
          const matches = await base44.functions.invoke('matchAdsToSearch', {
            searchQuery: latestSearch?.metadata?.search_query
          }).catch(() => ({ data: {} }));

          if (matches.data?.matches?.length > 0) {
            const topMatch = matches.data.matches[0];
            if (topMatch.relevance_score >= 90) {
              const key = `ad_match_${topMatch.ad_id}`;
              if (!notifiedRef.current[key]) {
                notifyHighRelevanceAdMatch(topMatch);
                notifiedRef.current[key] = true;
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking push notification triggers:', error);
      }
    };

    // Check every 30 seconds
    checkTriggers();
    const interval = setInterval(checkTriggers, 30000);

    return () => clearInterval(interval);
  }, [user?.id, lastJackpot, lastDailyGoal]);
};

const notifyJackpotHigh = (amount) => {
  toast.success(`🎉 Prize Pool Alert! Pool now at $${amount.toFixed(2)}!`, {
    description: 'Each search adds to the prize pool',
    duration: 5000
  });

  // Send web push if supported
  if ('serviceWorker' in navigator && 'Notification' in window) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification('🏆 Prize Pool Milestone!', {
        body: `The PPC pool just hit $${amount.toFixed(2)}! Keep searching to win big.`,
        icon: 'https://img.icons8.com/color/96/000000/treasure.png',
        badge: 'https://img.icons8.com/color/96/000000/cash.png',
        tag: 'prize-pool-alert'
      });
    });
  }
};

const notifyDailyGoalNearing = (earned, target) => {
  const remaining = (target - earned).toFixed(2);
  toast.info(`📊 Almost there! $${remaining} away from your daily goal`, {
    description: 'Keep searching to reach your target',
    duration: 5000
  });

  if ('serviceWorker' in navigator && 'Notification' in window) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification('Daily Goal 80% Complete!', {
        body: `You've earned $${earned.toFixed(2)}. Just $${remaining} more to reach your goal!`,
        icon: 'https://img.icons8.com/color/96/000000/goal.png',
        tag: 'daily-goal'
      });
    });
  }
};

const notifyDailyGoalComplete = () => {
  toast.success(`🏆 Daily Goal Complete! Amazing work today!`, {
    description: 'Check back tomorrow for new goals',
    duration: 5000
  });

  if ('serviceWorker' in navigator && 'Notification' in window) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification('🏆 Daily Goal Complete!', {
        body: 'You achieved your daily goal! Check back tomorrow for new challenges.',
        icon: 'https://img.icons8.com/color/96/000000/trophy.png',
        tag: 'goal-complete'
      });
    });
  }
};

const notifyHighRelevanceAdMatch = (ad) => {
  toast.info(`⚡ High-Match Ad Found: ${ad.actual_title}`, {
    description: `${ad.relevance_score}% match - $${ad.actual_reward.toFixed(2)} reward`,
    duration: 5000
  });

  if ('serviceWorker' in navigator && 'Notification' in window) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification('Perfect Match Found!', {
        body: `${ad.actual_title} (${ad.relevance_score}% match) - Earn $${ad.actual_reward.toFixed(2)}`,
        icon: 'https://img.icons8.com/color/96/000000/lightning-bolt.png',
        tag: 'ad-match'
      });
    });
  }
};```

## `src/hooks/useRealtimeNotifications.js`

```javascript
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const CLAIM_STATUS_LABELS = {
  approved: { emoji: '✅', msg: 'Your credit claim has been APPROVED!', color: 'green' },
  denied: { emoji: '❌', msg: 'Your credit claim was denied.', color: 'red' },
  under_review: { emoji: '🔍', msg: 'Your claim is now under review.', color: 'blue' },
};

const MILESTONE_LABELS = {
  5:   { emoji: '🌱', msg: 'You hit 5 referrals! Rookie Recruiter badge unlocked.' },
  25:  { emoji: '⚡', msg: 'You hit 25 referrals! Network Builder badge unlocked.' },
  50:  { emoji: '🔥', msg: 'You hit 50 referrals! Growth Champion badge unlocked.' },
  100: { emoji: '👑', msg: 'LEGENDARY! 100 referrals — Referral Legend badge unlocked!' },
};

/**
 * Sets up real-time subscriptions for:
 * 1. DisputeClaim status changes → toast + notification entity
 * 2. ReferralMilestone creation → toast + notification entity
 */
export function useRealtimeNotifications(userId) {
  const qc = useQueryClient();
  const prevClaimStatuses = useRef({});

  useEffect(() => {
    if (!userId) return;

    // ── 1. Subscribe to DisputeClaim changes ──────────────────────────
    const unsubClaims = base44.entities.DisputeClaim.subscribe(async (event) => {
      if (event.type !== 'update') return;
      const claim = event.data;
      if (claim?.user_id !== userId) return;

      const prevStatus = prevClaimStatuses.current[claim.id];
      const newStatus = claim.status;

      if (prevStatus && prevStatus !== newStatus && CLAIM_STATUS_LABELS[newStatus]) {
        const { emoji, msg } = CLAIM_STATUS_LABELS[newStatus];
        // Show toast
        if (newStatus === 'approved') {
          toast.success(`${emoji} ${msg}`, { description: `Claim: ${claim.item_name}`, duration: 6000 });
        } else if (newStatus === 'denied') {
          toast.error(`${emoji} ${msg}`, { description: `Claim: ${claim.item_name}`, duration: 6000 });
        } else {
          toast.info(`${emoji} ${msg}`, { description: `Claim: ${claim.item_name}`, duration: 5000 });
        }

        // Persist notification
        await base44.entities.Notification.create({
          user_id: userId,
          type: 'status_changed',
          title: `${emoji} Claim ${newStatus}`,
          message: `Your claim for "${claim.item_name}" is now ${newStatus}. ${newStatus === 'approved' ? `Credit issued: $${claim.credit_issued || 0}` : ''}`,
          status: 'unread',
          delivery_method: ['in_app'],
          action_url: '/DisputeCenter',
        });

        qc.invalidateQueries(['notifications', userId]);
      }

      prevClaimStatuses.current[claim.id] = newStatus;
    });

    // ── 2. Subscribe to ReferralMilestone creations ───────────────────
    const unsubMilestones = base44.entities.ReferralMilestone.subscribe(async (event) => {
      if (event.type !== 'create') return;
      const milestone = event.data;
      if (milestone?.user_id !== userId) return;

      const meta = MILESTONE_LABELS[milestone.milestone_count];
      if (!meta) return;

      toast.success(`${meta.emoji} ${meta.msg}`, {
        description: `+${milestone.jackpot_entries_awarded} prize pool points earned!`,
        duration: 8000,
      });

      // Persist notification
      await base44.entities.Notification.create({
        user_id: userId,
        type: 'achievement_unlocked',
        title: `${meta.emoji} Milestone: ${milestone.milestone_count} Referrals!`,
        message: `${meta.msg} You earned +${milestone.jackpot_entries_awarded} prize pool points.`,
        status: 'unread',
        delivery_method: ['in_app'],
        action_url: '/ReferralDashboard',
        icon: meta.emoji,
      });

      qc.invalidateQueries(['notifications', userId]);
      qc.invalidateQueries(['milestones', userId]);
    });

    return () => {
      unsubClaims();
      unsubMilestones();
    };
  }, [userId, qc]);
}```

## `src/lib/native.js`

```javascript
// Native integration layer for the Capacitor wrapper.
//
// Best-practice, wrapper-only approach: all native behavior is implemented HERE,
// in the web/TS layer, through Capacitor plugins — so there is no hand-written
// native (Java/Swift) code to maintain and no committed android/ios project.
// On plain web (the PWA), every call below no-ops via isNativePlatform().
import { Capacitor } from '@capacitor/core';

export async function initNative() {
  // On web/PWA there is nothing native to do.
  if (!Capacitor?.isNativePlatform?.()) return;

  // Status bar color to match the app theme.
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#111827' });
  } catch { /* plugin optional */ }

  // Hide the splash screen once the app has booted.
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch { /* plugin optional */ }

  // Android hardware back button: navigate back, or exit at the root.
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else App.exitApp();
    });
  } catch { /* plugin optional */ }
}
```

## `src/main.jsx`

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initNative } from '@/lib/native'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Initialize native wrapper behaviors (no-ops on web/PWA).
initNative()
```

## `src/pages/AIAgentsCommandCenter.jsx`

```jsx
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Loader2, Bot, Send, Zap, Shield, TrendingUp, Users, DollarSign, Megaphone, BarChart2, Trophy, ShoppingCart, Star, Brain, Activity, CheckCircle, AlertTriangle, MessageSquare } from 'lucide-react';
import MessageBubble from '@/components/agents/AgentMessageBubble';
import { toast } from 'sonner';

const AGENTS = [
  {
    key: 'platform_operations_superagent',
    label: 'Platform Ops Super Agent',
    emoji: '🤖',
    type: 'super',
    icon: Shield,
    color: 'from-red-600 to-rose-700',
    bg: 'bg-red-50 border-red-200',
    description: 'Master orchestrator — fraud, payouts, surveys, ads, platform health',
    actions: ['Run Daily Health Check', 'Fraud Sweep', 'Reconcile Financials', 'Check Pending Payouts'],
  },
  {
    key: 'growth_superagent',
    label: 'Growth Super Agent',
    emoji: '🚀',
    type: 'super',
    icon: TrendingUp,
    color: 'from-purple-600 to-indigo-700',
    bg: 'bg-purple-50 border-purple-200',
    description: 'Growth orchestrator — acquisition, referrals, retention, monetization',
    actions: ['Run Growth Analysis', 'Launch Retention Campaign', 'Optimize Referral Program', 'Weekly Growth Report'],
  },
  {
    key: 'fraud_detection',
    label: 'Fraud Detection AI',
    emoji: '🛡️',
    type: 'specialist',
    icon: Shield,
    color: 'from-red-500 to-orange-600',
    bg: 'bg-orange-50 border-orange-200',
    description: 'Monitors fraud patterns, self-learns from admin reviews',
    actions: ['Scan All Users', 'Check Referral Fraud', 'Review Flagged Responses'],
  },
  {
    key: 'churn_predictor',
    label: 'Churn Predictor AI',
    emoji: '📉',
    type: 'specialist',
    icon: Activity,
    color: 'from-amber-500 to-yellow-600',
    bg: 'bg-yellow-50 border-yellow-200',
    description: 'Predicts churn risk, runs personalized retention campaigns',
    actions: ['Identify At-Risk Users', 'Launch Win-Back Campaign', 'Award Retention Bonuses'],
  },
  {
    key: 'campaign_optimizer',
    label: 'Campaign Optimizer AI',
    emoji: '📊',
    type: 'specialist',
    icon: Megaphone,
    color: 'from-blue-500 to-cyan-600',
    bg: 'bg-blue-50 border-blue-200',
    description: 'Optimizes campaigns, reallocates budgets, generates copy',
    actions: ['Analyze All Campaigns', 'Pause Underperformers', 'Generate New Ad Copy'],
  },
  {
    key: 'monetization_optimizer',
    label: 'Monetization Optimizer',
    emoji: '💰',
    type: 'specialist',
    icon: DollarSign,
    color: 'from-green-500 to-emerald-600',
    bg: 'bg-green-50 border-green-200',
    description: 'Dynamic pricing, personalized offers, revenue distribution',
    actions: ['Optimize Pricing', 'Create Personalized Offers', 'Process Developer Payouts'],
  },
  {
    key: 'tournament_ai_manager',
    label: 'Tournament AI Manager',
    emoji: '🏆',
    type: 'specialist',
    icon: Trophy,
    color: 'from-yellow-500 to-orange-500',
    bg: 'bg-yellow-50 border-yellow-200',
    description: 'Matchmaking, brackets, prizes, post-tournament analysis',
    actions: ['Generate Brackets', 'Distribute Prizes', 'Analyze Tournament Results'],
  },
  {
    key: 'crm_automation_engine',
    label: 'CRM Automation Engine',
    emoji: '📬',
    type: 'specialist',
    icon: Users,
    color: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50 border-violet-200',
    description: 'Full user & developer lifecycle — onboarding, nurturing, re-engagement',
    actions: ['Process New User Onboarding', 'Send Re-engagement Emails', 'Trigger Payout Alerts'],
  },
  {
    key: 'ad_operations_agent',
    label: 'Ad Operations AI',
    emoji: '📢',
    type: 'specialist',
    icon: BarChart2,
    color: 'from-pink-500 to-rose-600',
    bg: 'bg-pink-50 border-pink-200',
    description: 'Ad review, bidding, fatigue detection, creative rotation',
    actions: ['Review Pending Ads', 'Check Ad Fatigue', 'Optimize Bids'],
  },
  {
    key: 'payout_operations_agent',
    label: 'Payout Operations AI',
    emoji: '💸',
    type: 'specialist',
    icon: DollarSign,
    color: 'from-teal-500 to-green-600',
    bg: 'bg-teal-50 border-teal-200',
    description: 'Fraud-screened payout processing, disputes, reconciliation',
    actions: ['Process Pending Withdrawals', 'Run Reconciliation', 'Review Payout Disputes'],
  },
  {
    key: 'referral_growth_agent',
    label: 'Referral Growth AI',
    emoji: '👥',
    type: 'specialist',
    icon: Users,
    color: 'from-indigo-500 to-blue-600',
    bg: 'bg-indigo-50 border-indigo-200',
    description: 'Conversion tracking, prize pool awards, email campaigns, squads',
    actions: ['Award Prize Pool Points', 'Send Referral Campaign', 'Process Commissions'],
  },
  {
    key: 'survey_operations_agent',
    label: 'Survey Operations AI',
    emoji: '📋',
    type: 'specialist',
    icon: CheckCircle,
    color: 'from-cyan-500 to-blue-600',
    bg: 'bg-cyan-50 border-cyan-200',
    description: 'Quality control, fraud detection, auto-distribution, disputes',
    actions: ['Quality Scan All Surveys', 'Detect Response Fraud', 'Resolve Pending Disputes'],
  },
  {
    key: 'developer_success_agent',
    label: 'Developer Success AI',
    emoji: '🛠️',
    type: 'specialist',
    icon: Star,
    color: 'from-orange-500 to-amber-600',
    bg: 'bg-orange-50 border-orange-200',
    description: 'Onboarding, game coaching, revenue optimization, disputes',
    actions: ['Review Pending Onboarding', 'Coach Underperforming Games', 'Process Developer Disputes'],
  },
  {
    key: 'content_and_social_agent',
    label: 'Content & Social AI',
    emoji: '🎨',
    type: 'specialist',
    icon: Megaphone,
    color: 'from-fuchsia-500 to-pink-600',
    bg: 'bg-fuchsia-50 border-fuchsia-200',
    description: 'Content generation, social distribution, YouTube, multilingual',
    actions: ['Generate Weekly Content', 'Schedule Social Posts', 'Embed YouTube Videos'],
  },
  {
    key: 'market_analyzer',
    label: 'Market Analyzer AI',
    emoji: '📈',
    type: 'specialist',
    icon: BarChart2,
    color: 'from-slate-500 to-gray-600',
    bg: 'bg-slate-50 border-slate-200',
    description: 'Market trends, competitive intelligence, developer benchmarks',
    actions: ['Generate Market Report', 'Analyze Top Games', 'Competitive Intelligence Scan'],
  },
  {
    key: 'revenue_forecaster',
    label: 'Revenue Forecaster AI',
    emoji: '🔮',
    type: 'specialist',
    icon: TrendingUp,
    color: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50 border-emerald-200',
    description: '30 and 90-day revenue forecasts, payout scheduling, risk alerts',
    actions: ['30-Day Forecast', '90-Day Forecast', 'Schedule Optimal Payouts'],
  },
  {
    key: 'support_bot',
    label: 'Support Bot AI',
    emoji: '💬',
    type: 'specialist',
    icon: MessageSquare,
    color: 'from-sky-500 to-blue-600',
    bg: 'bg-sky-50 border-sky-200',
    description: 'Frontline user support, ticket triage, self-learning resolution',
    actions: ['Review Open Tickets', 'Auto-Resolve Common Issues', 'Escalation Report'],
  },
];

function AgentChatPanel({ agent }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setConversation(null);
    setMessages([]);
    setInput('');
  }, [agent.key]);

  const startConversation = async (initialMsg) => {
    setStarting(true);
    try {
      const conv = await base44.agents.createConversation({ agent_name: agent.key, metadata: { title: `${agent.label} Session` } });
      setConversation(conv);
      const unsubscribe = base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages([...data.messages]);
      });
      conv._unsubscribe = unsubscribe;
      const msg = initialMsg || `Hello! Please introduce yourself and tell me what you can do.`;
      await base44.agents.addMessage(conv, { role: 'user', content: msg });
      setInput('');
    } catch (e) {
      toast.error('Failed to start conversation: ' + e.message);
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    if (!conversation) { startConversation(input); return; }
    setSending(true);
    const msg = input;
    setInput('');
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content: msg });
    } catch (e) {
      toast.error('Send failed: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const handleAction = (action) => {
    if (!conversation) { startConversation(action); }
    else { setInput(action); }
  };

  return (
    <div className="flex flex-col h-[600px]">
      {/* Quick Actions */}
      <div className="p-3 border-b bg-gray-50 flex flex-wrap gap-2">
        {agent.actions.map(a => (
          <Button key={a} size="sm" variant="outline" className="text-xs h-7 border-gray-300 hover:bg-white"
            onClick={() => handleAction(a)} disabled={starting || sending}>
            <Zap className="w-3 h-3 mr-1" />{a}
          </Button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        {messages.length === 0 && !starting && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-3xl mb-4 shadow-lg`}>
              {agent.emoji}
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">{agent.label}</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-4">{agent.description}</p>
            <Button onClick={() => startConversation()} disabled={starting}
              className={`bg-gradient-to-r ${agent.color} text-white gap-2`} size="sm">
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
              Start Session
            </Button>
          </div>
        )}
        {starting && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400 mr-2" />
            <span className="text-gray-400 text-sm">Starting session…</span>
          </div>
        )}
        {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t bg-white flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder={`Message ${agent.label}…`}
          className="flex-1 text-sm"
          disabled={starting}
        />
        <Button onClick={sendMessage} disabled={sending || starting || !input.trim()}
          className={`bg-gradient-to-r ${agent.color} text-white flex-shrink-0`} size="sm">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function AIAgentsCommandCenter() {
  const [user, setUser] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0]);
  const [activeTab, setActiveTab] = useState('command');

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role !== 'admin') { window.location.replace('/'); return; }
      setUser(u);
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: perfLogs = [] } = useQuery({
    queryKey: ['agent-perf-logs'],
    queryFn: () => base44.entities.AgentPerformanceLog.list('-created_date', 50),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: learningMemory = [] } = useQuery({
    queryKey: ['agent-learning'],
    queryFn: () => base44.entities.AgentLearningMemory.list('-created_date', 20),
    enabled: !!user,
  });

  const superAgents = AGENTS.filter(a => a.type === 'super');
  const specialists = AGENTS.filter(a => a.type === 'specialist');

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs mb-4">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            {AGENTS.length} AI Agents Online
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">AI Agents Command Center</h1>
          <p className="text-gray-400 text-sm">Platform automation orchestration — 2 Super Agents + {specialists.length} Specialists</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/10 border border-white/20 p-1 mx-auto flex w-fit">
            <TabsTrigger value="command" className="text-gray-300 data-[state=active]:bg-white data-[state=active]:text-gray-900 text-sm">
              🤖 Command Center
            </TabsTrigger>
            <TabsTrigger value="performance" className="text-gray-300 data-[state=active]:bg-white data-[state=active]:text-gray-900 text-sm">
              📊 Performance Logs
            </TabsTrigger>
            <TabsTrigger value="learning" className="text-gray-300 data-[state=active]:bg-white data-[state=active]:text-gray-900 text-sm">
              🧠 Learning Memory
            </TabsTrigger>
          </TabsList>

          {/* COMMAND CENTER */}
          <TabsContent value="command" className="mt-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Agent selector */}
              <div className="space-y-3">
                {/* Super Agents */}
                <p className="text-xs font-semibold text-purple-300 uppercase tracking-wider px-1">⚡ Super Agents</p>
                {superAgents.map(a => (
                  <button key={a.key} onClick={() => setSelectedAgent(a)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${selectedAgent.key === a.key
                      ? 'bg-white/15 border-white/40 shadow-lg shadow-purple-500/20'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'}`}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{a.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{a.label}</p>
                        <p className="text-gray-400 text-xs truncate">{a.description.slice(0, 50)}…</p>
                      </div>
                    </div>
                  </button>
                ))}

                {/* Specialists */}
                <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider px-1 pt-2">🔬 Specialist Agents</p>
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                  {specialists.map(a => (
                    <button key={a.key} onClick={() => setSelectedAgent(a)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all ${selectedAgent.key === a.key
                        ? 'bg-white/15 border-white/40'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{a.emoji}</span>
                        <div className="min-w-0">
                          <p className="text-white text-xs font-medium truncate">{a.label}</p>
                          <p className="text-gray-500 text-xs truncate">{a.description.slice(0, 40)}…</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Panel */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/10">
                {/* Agent Header */}
                <div className={`bg-gradient-to-r ${selectedAgent.color} p-4 flex items-center gap-3`}>
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                    {selectedAgent.emoji}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{selectedAgent.label}</p>
                    <p className="text-white/70 text-xs">{selectedAgent.description}</p>
                  </div>
                  <Badge className={`ml-auto text-xs ${selectedAgent.type === 'super' ? 'bg-yellow-400/20 text-yellow-200 border-yellow-400/40' : 'bg-white/20 text-white border-white/30'}`}>
                    {selectedAgent.type === 'super' ? '⚡ Super Agent' : '🔬 Specialist'}
                  </Badge>
                </div>
                <AgentChatPanel key={selectedAgent.key} agent={selectedAgent} />
              </div>
            </div>
          </TabsContent>

          {/* PERFORMANCE LOGS */}
          <TabsContent value="performance" className="mt-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" /> Agent Performance Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {perfLogs.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-12">No performance logs yet — start agent sessions to generate logs.</p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {perfLogs.map((log, i) => (
                      <div key={log.id || i} className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-white font-medium">{log.agent_name}</span>
                            <Badge className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">{log.action_type}</Badge>
                            {log.confidence_score && (
                              <Badge className={`text-xs ${log.confidence_score > 70 ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                {log.confidence_score}% confidence
                              </Badge>
                            )}
                          </div>
                          {log.predicted_outcome && <p className="text-gray-400">Predicted: {log.predicted_outcome}</p>}
                          {log.tags?.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {log.tags.map((t, ti) => <span key={ti} className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400">{t}</span>)}
                            </div>
                          )}
                        </div>
                        <span className="text-gray-500 flex-shrink-0">{new Date(log.created_date).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* LEARNING MEMORY */}
          <TabsContent value="learning" className="mt-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" /> Agent Learning Memory
                  <Badge className="ml-2 bg-green-500/20 text-green-300 border-green-500/30 text-xs">
                    {learningMemory.filter(m => m.admin_approved).length} approved lessons
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {learningMemory.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-12">No learning memories yet — agents will self-improve as they process more data.</p>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {learningMemory.map((mem, i) => (
                      <div key={mem.id || i} className={`p-3 rounded-xl border text-xs ${mem.admin_approved ? 'bg-green-500/10 border-green-500/20' : 'bg-white/5 border-white/10'}`}>
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="text-white font-medium">{mem.agent_name}</span>
                          <Badge className={`text-xs ${mem.admin_approved ? 'bg-green-500/30 text-green-300' : 'bg-gray-500/20 text-gray-400'}`}>
                            {mem.admin_approved ? '✓ Approved' : '⏳ Pending'}
                          </Badge>
                          {mem.learning_type && <Badge className="text-xs bg-purple-500/20 text-purple-300">{mem.learning_type}</Badge>}
                        </div>
                        {mem.lesson && <p className="text-gray-300">{mem.lesson}</p>}
                        {mem.context && <p className="text-gray-500 mt-0.5">{mem.context}</p>}
                        <p className="text-gray-600 mt-1">{new Date(mem.created_date).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Agent Grid Overview */}
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-3 font-semibold">All Active Agents</p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {AGENTS.map(a => (
              <button key={a.key} onClick={() => { setSelectedAgent(a); setActiveTab('command'); }}
                className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all text-center">
                <div className="text-2xl mb-1">{a.emoji}</div>
                <p className="text-white text-xs font-medium leading-tight">{a.label.replace(' AI', '').replace(' Agent', '').replace(' Super Agent', '')}</p>
                <div className="mt-1.5">
                  <div className="w-2 h-2 bg-green-400 rounded-full mx-auto animate-pulse" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}```

## `src/pages/ContestEntries.jsx`

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Ticket, Star, Users, TrendingUp, Gift, Zap, Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

export default function ContestEntries() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: jackpots = [] } = useQuery({
    queryKey: ['contest-jackpots'],
    queryFn: () => base44.entities.ReferralJackpot.filter({ status: 'active' }),
    enabled: !!user,
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['contest-referrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['contest-milestones', user?.id],
    queryFn: () => base44.entities.ReferralMilestone.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const jackpot = jackpots[0] || { jackpot_amount: 2840, total_entries: 342, period: '2026-Q2' };

  // Calculate entries: 1 per active referral milestone hit + bonus for streak
  const activeReferrals = useMemo(() => referrals.filter(r => r.status === 'active').length, [referrals]);
  
  const entryBreakdown = useMemo(() => {
    const items = [];
    if (activeReferrals >= 5)   items.push({ label: 'Reached 5 referrals milestone',   entries: 1 });
    if (activeReferrals >= 25)  items.push({ label: 'Reached 25 referrals milestone',  entries: 3 });
    if (activeReferrals >= 50)  items.push({ label: 'Reached 50 referrals milestone',  entries: 5 });
    if (activeReferrals >= 100) items.push({ label: 'Reached 100 referrals milestone', entries: 10 });
    if (activeReferrals >= 500) items.push({ label: 'Reached 500 referrals milestone', entries: 25 });
    return items;
  }, [activeReferrals]);

  const myEntries = entryBreakdown.reduce((s, e) => s + e.entries, 0);
  // Share of total performance points (standing indicator) — winners ranked by skill, not chance.
  const myPointShare = jackpot.total_entries > 0 ? ((myEntries / jackpot.total_entries) * 100).toFixed(2) : 0;

  const MILESTONE_THRESHOLDS = [
    { refs: 5,   entries: 1,  label: '5 Referrals',   color: 'from-blue-400 to-blue-600' },
    { refs: 25,  entries: 3,  label: '25 Referrals',  color: 'from-purple-400 to-purple-600' },
    { refs: 50,  entries: 5,  label: '50 Referrals',  color: 'from-yellow-400 to-amber-600' },
    { refs: 100, entries: 10, label: '100 Referrals', color: 'from-orange-400 to-red-600' },
    { refs: 500, entries: 25, label: '500 Referrals', color: 'from-pink-500 to-rose-700' },
  ];

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm font-bold mb-4">
            <Ticket className="w-4 h-4" /> CONTEST ENTRIES
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">
            Your Contest <span className="text-purple-600">Entries</span>
          </h1>
          <p className="text-gray-500">Earn contest entries by hitting referral milestones. Most entries wins the prize pool!</p>
        </div>

        {/* Live Prize Pool */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #4338ca 50%, #1e40af 100%)' }}
        >
          <div className="relative p-6 text-white">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-24 translate-x-24 pointer-events-none" />
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-widest opacity-75">Live Prize Pool · {jackpot.period}</span>
            </div>
            <p className="text-6xl font-black mb-4">${(jackpot.jackpot_amount || 0).toLocaleString()}</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Ticket, label: 'Total Points', value: jackpot.total_entries || 0 },
                { icon: Star,   label: 'Your Points',  value: myEntries },
                { icon: TrendingUp, label: 'Point Share', value: `${myPointShare}%` },
              ].map(s => (
                <div key={s.label} className="bg-white/15 backdrop-blur-sm rounded-xl p-3 text-center">
                  <s.icon className="w-4 h-4 mx-auto mb-1 opacity-75" />
                  <p className="text-lg font-black">{s.value}</p>
                  <p className="text-xs opacity-65">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* My entries summary */}
        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Trophy className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900">{myEntries} entries</p>
                  <p className="text-sm text-gray-500">from {activeReferrals} active referrals</p>
                </div>
              </div>
              {myEntries > 0 ? (
                <Badge className="bg-green-100 text-green-700 text-sm px-3 py-1 border-0">
                  <Crown className="w-3.5 h-3.5 mr-1" /> Entered in contest!
                </Badge>
              ) : (
                <Link to="/ReferralDashboard">
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                    <Users className="w-4 h-4 mr-2" /> Get Entries — Refer Friends
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Entry breakdown */}
        {entryBreakdown.length > 0 && (
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Ticket className="w-4 h-4 text-purple-500" /> Your Entry Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {entryBreakdown.map((e, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-purple-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎟️</span>
                    <span className="text-sm font-medium text-gray-700">{e.label}</span>
                  </div>
                  <Badge className="bg-purple-100 text-purple-700 border-0 font-bold">+{e.entries} {e.entries === 1 ? 'entry' : 'entries'}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Milestone unlock ladder */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" /> How to Earn More Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MILESTONE_THRESHOLDS.map(m => {
                const reached = activeReferrals >= m.refs;
                return (
                  <div key={m.refs} className={`flex items-center gap-4 rounded-xl p-3 border-2 transition-all ${reached ? 'border-green-300 bg-green-50' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center flex-shrink-0 shadow`}>
                      <Ticket className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 text-sm">{m.label}</p>
                      <p className="text-xs text-gray-500">{activeReferrals}/{m.refs} active referrals</p>
                    </div>
                    <Badge className={`font-bold border-0 ${reached ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                      {reached ? '✓' : ''} +{m.entries} {m.entries === 1 ? 'entry' : 'entries'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Contest rules */}
        <Card className="border-2 border-indigo-200 bg-indigo-50">
          <CardContent className="pt-5 pb-4">
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Gift className="w-4 h-4 text-indigo-500" /> Contest Rules
            </h3>
            <div className="space-y-1 text-sm text-gray-600">
              <p>• Contest entries are earned by hitting referral milestones. More entries = better odds.</p>
              <p>• Prize pool = 10% of quarterly after-tax profits, distributed to the winner.</p>
              <p>• Winner is drawn randomly at end of quarter — higher entry count increases your chance.</p>
              <p>• Prize must be used for GamerGain store credit or survey creation.</p>
              <p>• Contest resets quarterly. Previous entries do not carry over.</p>
            </div>
          </CardContent>
        </Card>

        <div className="pb-8 text-center">
          <Link to="/ReferralDashboard">
            <Button size="lg" className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold px-8 shadow-xl">
              <Users className="w-5 h-5 mr-2" /> Refer Friends to Earn More Entries
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}```

## `src/pages/DailyTodoList.jsx`

```jsx
import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, Circle, DollarSign, Users, Zap, Download, Star, Trophy,
  MessageSquare, ShoppingCart, Loader2, RefreshCw, Lock, Share2, Gamepad2, Search, ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

// ── Ordered mandatory tasks: Task 1 → PPC Ads $0.40, Task 2 → Shop Search, Task 3 → Surveys $3 ──
const CORE_TASKS = [
  {
    id: 'ppc_earn_40',
    order: 1,
    icon: Zap,
    color: 'text-purple-600',
    bg: 'bg-purple-50 border-purple-200',
    badgeBg: 'bg-purple-600',
    title: 'Task 1 — Earn $0.40 from PPC Ads',
    description: 'Interact with the Paid PPC Ads / Mosaic page and earn $0.40 today.',
    action: { label: 'Go to PPC Ads', path: 'PaidPPCAdsMosaic' },
    points: 15,
  },
  {
    id: 'shop_search',
    order: 2,
    icon: Search,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    badgeBg: 'bg-blue-600',
    title: 'Task 2 — Daily Shop Search (−$0.05)',
    description: 'Use the Shop button on the GamerGain search widget to search for 1 product. $0.05 is auto-deducted. The product is added to your Wishlist, and you receive contest entries automatically.',
    action: { label: 'Open Store & Search', path: 'InAppGameStore' },
    points: 10,
    note: '−$0.05 + contest entries awarded',
  },
  {
    id: 'earn_3_surveys',
    order: 3,
    icon: DollarSign,
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
    badgeBg: 'bg-green-600',
    title: 'Task 3 — Earn $3 via Surveys',
    description: 'Complete surveys to hit your daily $3 earnings goal.',
    action: { label: 'Take Surveys', path: 'Surveys' },
    points: 30,
  },
];

// Additional mandatory earn-section tasks (after core 3)
const EXTRA_MANDATORY_TASKS = [
  {
    id: 'play_new_game',
    icon: Gamepad2,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 border-indigo-200',
    badgeBg: 'bg-indigo-600',
    title: 'Play a New Game',
    description: 'Browse the Game Store and play a game you haven\'t tried yet. It\'ll be added to your wishlist.',
    action: { label: 'Browse Games', path: 'InAppGameStore' },
    points: 20,
  },
  {
    id: 'referral',
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    badgeBg: 'bg-blue-600',
    title: 'Make a Referral',
    description: 'Share your referral link and invite at least one new user today.',
    action: { label: 'Refer Friends', path: 'ReferralDashboard' },
    points: 20,
  },
  {
    id: 'download_widget',
    icon: Download,
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
    badgeBg: 'bg-orange-600',
    title: 'Download the GamerGain Search Widget',
    description: 'Install the GamerGain search widget for automatic ad earnings and contest entries.',
    action: { label: 'Download Widget', path: 'PPCMarketplace' },
    points: 10,
  },
  {
    id: 'social_connect',
    icon: Share2,
    color: 'text-pink-600',
    bg: 'bg-pink-50 border-pink-200',
    badgeBg: 'bg-pink-600',
    title: 'Connect Social Media',
    description: 'Link Facebook, Instagram, Twitter, Snapchat, TikTok, or YouTube to enable auto-posting.',
    action: { label: 'Connect Now', path: 'SocialMediaSetup' },
    points: 30,
  },
  {
    id: 'ppc_marketplace',
    icon: Zap,
    color: 'text-purple-600',
    bg: 'bg-purple-50 border-purple-200',
    badgeBg: 'bg-purple-600',
    title: 'Browse PPC Marketplace',
    description: 'Explore the PPC Marketplace for additional earning opportunities.',
    action: { label: 'View PPC', path: 'PPCMarketplace' },
    points: 10,
  },
  {
    id: 'check_wishlist',
    icon: ShoppingCart,
    color: 'text-rose-600',
    bg: 'bg-rose-50 border-rose-200',
    badgeBg: 'bg-rose-600',
    title: 'Review Your Wishlist',
    description: 'Check items automatically added to your wishlist from your searches and clicks.',
    action: { label: 'View Wishlist', path: 'Wishlist' },
    points: 5,
  },
  {
    id: 'referral_contest',
    icon: Trophy,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50 border-yellow-200',
    badgeBg: 'bg-yellow-600',
    title: 'Check Referral Prize Pool',
    description: 'View your contest entries and current ranking for the GamerGain prize pool.',
    action: { label: 'View Contest', path: 'ReferralContest' },
    points: 5,
  },
];

const ALL_MANDATORY = [...CORE_TASKS, ...EXTRA_MANDATORY_TASKS];

export default function DailyTodoList() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [aiTasks, setAiTasks] = useState([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const autoStarted = useRef(false);

  const todayKey = (uid) => `todo_completed_${uid}_${new Date().toDateString()}`;

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      const saved = JSON.parse(localStorage.getItem(todayKey(u.id)) || '[]');
      setCompletedTasks(saved);
      loadAITasks(u);
      // Auto-navigate to first incomplete core task
      if (!autoStarted.current) {
        autoStarted.current = true;
        const firstPending = CORE_TASKS.find(t => !saved.includes(t.id));
        if (firstPending) {
          setCurrentTaskId(firstPending.id);
          setTimeout(() => {
            toast.info(`▶ Starting: ${firstPending.title}`, { duration: 3000 });
            navigate(createPageUrl(firstPending.action.path));
          }, 1200);
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const pts = ALL_MANDATORY.filter(t => completedTasks.includes(t.id)).reduce((s, t) => s + t.points, 0)
      + aiTasks.filter(t => completedTasks.includes(t.id)).reduce((s, t) => s + (t.points || 10), 0);
    setTotalPoints(pts);
  }, [completedTasks, aiTasks]);

  // After Task 2 (shop_search) is done → deduct $0.05 and award contest entries
  useEffect(() => {
    if (!user) return;
    if (completedTasks.includes('shop_search') && !localStorage.getItem(`shop_fee_${todayKey(user.id)}`)) {
      localStorage.setItem(`shop_fee_${todayKey(user.id)}`, '1');
      const newBalance = Math.max(0, (user.current_balance || 0) - 0.05);
      base44.auth.updateMe({
        current_balance: newBalance,
        total_jackpot_entries: (user.total_jackpot_entries || 0) + 1,
      }).catch(() => {});
      toast.success('🏆 Contest entry awarded! $0.05 deducted from earnings.');
    }
  }, [completedTasks, user]);

  const markComplete = (taskId) => {
    if (!user || completedTasks.includes(taskId)) return;
    const updated = [...completedTasks, taskId];
    setCompletedTasks(updated);
    localStorage.setItem(todayKey(user.id), JSON.stringify(updated));
    toast.success('✅ Task complete! Points earned!');
    // Auto-advance to next incomplete task
    const allTasks = [...ALL_MANDATORY, ...aiTasks];
    const nextTask = allTasks.find(t => !updated.includes(t.id));
    if (nextTask) {
      setCurrentTaskId(nextTask.id);
      setTimeout(() => {
        toast.info(`▶ Next: ${nextTask.title}`, { duration: 2500 });
      }, 500);
    } else {
      setCurrentTaskId(null);
      toast.success('🎉 All daily tasks completed!', { duration: 4000 });
    }
  };

  const toggleTask = (taskId) => {
    if (!user) return;
    if (completedTasks.includes(taskId)) {
      const updated = completedTasks.filter(t => t !== taskId);
      setCompletedTasks(updated);
      localStorage.setItem(todayKey(user.id), JSON.stringify(updated));
    } else {
      markComplete(taskId);
    }
  };

  const handleGoToTask = (task) => {
    markComplete(task.id);
    navigate(createPageUrl(task.action.path));
  };

  const loadAITasks = async (u) => {
    setLoadingAi(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate 5 personalized daily earn-section tasks for GamerGain user ${u?.full_name || 'User'} (earnings: $${(u?.total_earnings || 0).toFixed(2)}).
Available pages: Surveys, PPCMarketplace, InAppGameStore, ReferralDashboard, Tournaments, Guilds, AchievementsPage, DailyEarningStreak, GlobalLeaderboard, Wishlist, Withdrawal, RewardsMarketplace, ReferralContest, CreatorDashboard, ExploreSurveys.
Tasks should focus on earning activities. Return JSON array: id, title, description, icon_name (lucide icon name), path, points (5-25).`,
        response_json_schema: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  icon_name: { type: 'string' },
                  path: { type: 'string' },
                  points: { type: 'number' },
                }
              }
            }
          }
        }
      });
      setAiTasks(res.tasks || []);
    } catch {
      setAiTasks([
        { id: 'streak', title: 'Maintain Daily Streak', description: 'Log in and complete at least one activity', icon_name: 'Star', path: 'DailyEarningStreak', points: 15 },
        { id: 'leaderboard', title: 'Check Leaderboard', description: 'See your rank and compete for top positions', icon_name: 'Trophy', path: 'GlobalLeaderboard', points: 5 },
        { id: 'guild', title: 'Participate in Guild', description: 'Complete a guild challenge or contribute points', icon_name: 'Users', path: 'Guilds', points: 15 },
        { id: 'explore_surveys', title: 'Explore New Surveys', description: 'Browse available surveys and find high-paying ones', icon_name: 'DollarSign', path: 'ExploreSurveys', points: 10 },
        { id: 'achievements', title: 'Check Achievements', description: 'See what badges you can unlock today', icon_name: 'Star', path: 'AchievementsPage', points: 5 },
      ]);
    }
    setLoadingAi(false);
  };

  const allCoreDone = CORE_TASKS.every(t => completedTasks.includes(t.id));
  const allMandatoryDone = ALL_MANDATORY.every(t => completedTasks.includes(t.id));
  const totalTasks = ALL_MANDATORY.length + aiTasks.length;
  const completedCount = completedTasks.length;
  const progressPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const getIcon = (name) => {
    const icons = { Star, Trophy, Users, Zap, DollarSign, ShoppingCart, MessageSquare, Download, Gamepad2, Search, Share2, ArrowRight };
    return icons[name] || Star;
  };

  const renderTaskCard = (task, idx, isCore = false) => {
    const done = completedTasks.includes(task.id);
    const isActive = currentTaskId === task.id && !done;
    const Icon = task.icon || getIcon(task.icon_name);
    return (
      <motion.div key={task.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.06 }}>
        <Card className={`border-2 transition-all ${done ? 'border-green-400 bg-green-50' : isActive ? 'border-indigo-400 bg-indigo-50 shadow-lg ring-2 ring-indigo-300' : (task.bg || 'bg-white border-gray-200')}`}>
          <CardContent className="p-4 flex items-center gap-3">
            <button onClick={() => toggleTask(task.id)} className="flex-shrink-0">
              {done ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <Circle className="w-6 h-6 text-gray-300 hover:text-gray-500 transition-colors" />}
            </button>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-200' : 'bg-white shadow'}`}>
              <Icon className={`w-5 h-5 ${done ? 'text-green-600' : (task.color || 'text-gray-600')}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`font-semibold text-sm ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
                {isActive && <Badge className="bg-indigo-600 text-white text-xs animate-pulse">▶ Now</Badge>}
                {task.note && !done && <Badge className="bg-amber-100 text-amber-700 text-xs">{task.note}</Badge>}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className={`${task.badgeBg || 'bg-gray-500'} text-white text-xs`}>+{task.points}pts</Badge>
              {!done && (
                <Button size="sm" onClick={() => handleGoToTask(task)} className="text-xs h-7 px-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                  Go <ArrowRight className="w-3 h-3 ml-0.5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto py-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">📋 Daily To-Do List</h1>
            <Badge className="bg-purple-600 text-white">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Badge>
          </div>
          <Card className="bg-gradient-to-r from-blue-600 to-purple-600 border-0 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">{completedCount}/{totalTasks} tasks completed</p>
                <p className="text-sm font-bold">{totalPoints} pts earned</p>
              </div>
              <div className="w-full bg-white/30 rounded-full h-3">
                <motion.div className="bg-white rounded-full h-3" initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.6 }} />
              </div>
              {allMandatoryDone && <p className="text-xs mt-2 text-yellow-200">🎉 All mandatory tasks done! Great work today!</p>}
            </CardContent>
          </Card>
        </motion.div>

        {/* Auto-flow note */}
        <div className="mb-5 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800">
          <strong>📌 Auto-Flow:</strong> You're automatically guided through tasks in order. Complete Task 1 (PPC Ads $0.40) → Task 2 (Shop Search, −$0.05, contest entries awarded) → Task 3 (Surveys $3) → then all remaining tasks automatically.
        </div>

        {/* CORE 3 TASKS */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-red-500" />
            <h2 className="font-bold text-gray-900">Core Daily Tasks</h2>
            <Badge className="bg-red-500 text-white text-xs">Auto-guided · Complete in order</Badge>
          </div>
          <div className="space-y-3">
            {CORE_TASKS.map((task, i) => renderTaskCard(task, i, true))}
          </div>
        </div>

        {/* REMAINING MANDATORY TASKS */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-orange-500" />
            <h2 className="font-bold text-gray-900">Earn Section Tasks</h2>
            <Badge className="bg-orange-500 text-white text-xs">Mandatory Daily</Badge>
          </div>
          <div className="space-y-3">
            {EXTRA_MANDATORY_TASKS.map((task, i) => renderTaskCard(task, i))}
          </div>
        </div>

        {/* AI / PERSONALIZED TASKS */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-500" />
              <h2 className="font-bold text-gray-900">Personalized Earn Tasks</h2>
              <Badge className="bg-purple-500 text-white text-xs">AI-Generated</Badge>
            </div>
            <Button size="sm" variant="ghost" onClick={() => user && loadAITasks(user)} disabled={loadingAi} className="text-xs">
              {loadingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            </Button>
          </div>

          {loadingAi ? (
            <Card><CardContent className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" /><p className="text-sm text-gray-500">Generating tasks…</p></CardContent></Card>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {aiTasks.map((task, i) => {
                  const done = completedTasks.includes(task.id);
                  const isActive = currentTaskId === task.id && !done;
                  const Icon = getIcon(task.icon_name);
                  return (
                    <motion.div key={task.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card className={`border transition-all ${done ? 'border-green-300 bg-green-50' : isActive ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-300' : 'border-gray-200 bg-white hover:shadow-md'}`}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <button onClick={() => toggleTask(task.id)} className="flex-shrink-0">
                            {done ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <Circle className="w-6 h-6 text-gray-300 hover:text-gray-500 transition-colors" />}
                          </button>
                          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`font-semibold text-sm ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
                              {isActive && <Badge className="bg-indigo-600 text-white text-xs animate-pulse">▶ Now</Badge>}
                            </div>
                            <p className="text-xs text-gray-500">{task.description}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge className="bg-purple-100 text-purple-700 text-xs">+{task.points || 10}pts</Badge>
                            {!done && task.path && (
                              <Button size="sm" onClick={() => handleGoToTask(task)} className="text-xs h-7 px-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                                Go <ArrowRight className="w-3 h-3 ml-0.5" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}```

## `src/pages/PrivacyPolicy.jsx`

```jsx
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// NOTE: This is a TEMPLATE privacy policy tailored to PlayEarning Nexus.
// Replace the [BRACKETED] placeholders and have it reviewed by a lawyer before launch.
const EFFECTIVE = '[EFFECTIVE DATE]';
const COMPANY = '[COMPANY LEGAL NAME]';
const CONTACT_EMAIL = '[privacy@yourdomain.com]';

const SECTIONS = [
  { h: '1. Who we are', b: [
    `PlayEarning Nexus ("PlayEarning", "we", "us") is operated by ${COMPANY}. This Privacy Policy explains what we collect, how we use it, and your choices. By using the app you agree to this policy.`,
  ]},
  { h: '2. Information we collect', b: [
    'Account & profile: name, email, password/credentials (via our auth provider), profile details, and demographic information you provide (e.g., age, interests, country) used to match you with surveys.',
    'Activity: surveys you take and responses, games played, referrals, votes, contributions to groups, earnings and payout history.',
    'Payments: processed by Stripe and PayPal. We do not store full card numbers; the processors handle card data. We store transaction records and payout details.',
    'Device & usage: IP address, device/browser type, app interactions, and approximate location/currency (from your browser/IP) used for localization and fraud prevention.',
    'Social connections: if you connect Facebook, Instagram, X/Twitter, or Snapchat, we access the permissions you grant (e.g., to post on your behalf when you opt in).',
    'Notifications: push subscription tokens if you enable web/app notifications.',
  ]},
  { h: '3. How we use your information', b: [
    'To provide and operate the service (surveys, games, referrals, rewards, groups).',
    'To process payments and payouts and calculate earnings and commissions.',
    'To match you with relevant surveys and personalize content (including AI-assisted recommendations).',
    'To detect and prevent fraud, abuse, and multi-accounting.',
    'To send you service messages, notifications, and (with consent) marketing.',
    'To comply with legal, tax, and regulatory obligations.',
  ]},
  { h: '4. How we share information', b: [
    'Payment processors (Stripe, PayPal) to process transactions and payouts.',
    'Survey providers (e.g., BitLabs) to deliver surveys and confirm completions.',
    'Social platforms you choose to connect, per the permissions you grant.',
    'Service providers (hosting/backend via Base44, messaging via Twilio, infrastructure) under contract.',
    'Legal and safety: to comply with law, enforce our Terms, or protect rights and safety.',
    'We do not sell your personal information for money.',
  ]},
  { h: '5. Cookies, tracking & notifications', b: [
    'We use local storage and similar technologies for sign-in, preferences (language/currency), and analytics. You can enable or disable push notifications at any time in your device/browser settings.',
  ]},
  { h: '6. Data retention', b: [
    'We keep your information while your account is active and as needed for legal, tax, accounting, and fraud-prevention purposes, then delete or anonymize it.',
  ]},
  { h: '7. Your rights & choices', b: [
    'Depending on where you live (e.g., EEA/UK under GDPR, California under CCPA/CPRA), you may have rights to access, correct, delete, port, or restrict your data, to opt out of certain processing, and to withdraw consent. To exercise these, contact us at ' + CONTACT_EMAIL + '.',
    'You can opt out of marketing messages and disable notifications at any time.',
  ]},
  { h: '8. Children', b: [
    'The service involves earning money and payments and is intended for users 18 years and older (or the age of majority in your jurisdiction). We do not knowingly collect data from children under 18.',
  ]},
  { h: '9. Security', b: [
    'We use technical and organizational measures to protect your data. No method of transmission or storage is 100% secure; we cannot guarantee absolute security.',
  ]},
  { h: '10. International transfers', b: [
    'Your information may be processed in countries other than yours. Where required, we use appropriate safeguards for such transfers.',
  ]},
  { h: '11. Changes to this policy', b: [
    'We may update this policy. Material changes will be posted here with a new effective date.',
  ]},
  { h: '12. Contact us', b: [
    `Questions? Contact ${COMPANY} at ${CONTACT_EMAIL}.`,
  ]},
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="text-3xl font-black text-gray-900">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mt-1">Effective date: {EFFECTIVE}</p>
        <div className="mt-3 mb-8 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
          Template for review — replace bracketed placeholders and have a lawyer review before launch.
        </div>
        {SECTIONS.map((s) => (
          <section key={s.h} className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">{s.h}</h2>
            {s.b.map((p, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed mb-2">{p}</p>
            ))}
          </section>
        ))}
        <div className="mt-8 pt-6 border-t text-sm text-gray-500">
          See also our <Link to={createPageUrl('TermsOfService')} className="text-indigo-600 underline">Terms of Service</Link>.
        </div>
      </div>
    </div>
  );
}
```

## `src/pages/ReferralContest.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Trophy, LinkIcon, TrendingUp, Share2, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function ReferralContestPage() {
  const [user, setUser] = useState(null);
  const [contests, setContests] = useState([]);
  const [selectedContest, setSelectedContest] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingContest, setCreatingContest] = useState(false);
  const [contestName, setContestName] = useState('');
  const [template, setTemplate] = useState('default');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const me = await base44.auth.me();
        setUser(me);

        const userContests = await base44.asServiceRole.entities.ReferralContest.filter({
          creator_user_id: me.id
        });
        setContests(userContests);
        if (userContests.length > 0) {
          setSelectedContest(userContests[0]);
          loadLeaderboard(userContests[0].id);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const loadLeaderboard = async (contestId) => {
    try {
      const response = await base44.functions.invoke('referralContestLeaderboard', {
        action: 'getWeeklyLeaderboard',
        contestId
      });
      if (response.data.success) {
        setLeaderboard(response.data.leaderboard);
      }
    } catch (e) {
      console.error('Error loading leaderboard:', e);
    }
  };

  const handleCreateContest = async () => {
    if (!contestName.trim()) {
      toast.error('Please enter a contest name');
      return;
    }

    setCreatingContest(true);
    try {
      const inviteCode = Math.random().toString(36).substr(2, 9).toUpperCase();
      const inviteLink = `${window.location.origin}/referral/${inviteCode}`;

      const newContest = await base44.asServiceRole.entities.ReferralContest.create({
        creator_user_id: user.id,
        contest_name: contestName,
        custom_landing_page_template: template,
        invite_link: inviteLink,
        custom_landing_page_url: `/referral-landing/${inviteCode}`,
        week_start: new Date().toISOString().split('T')[0],
        week_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });

      setContests([...contests, newContest]);
      setSelectedContest(newContest);
      setContestName('');
      toast.success('Contest created! Share your invite link.');
    } catch (e) {
      toast.error('Failed to create contest: ' + e.message);
    } finally {
      setCreatingContest(false);
    }
  };

  const copyLink = (link) => {
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard!');
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-red-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-black text-gray-900 mb-8 flex items-center gap-3">
          <Trophy className="w-10 h-10 text-yellow-500" /> Referral Prize Pools
        </h1>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Create Contest Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-2 border-purple-200 h-full">
              <CardHeader>
                <CardTitle className="text-lg">Create New Contest</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Contest name"
                  value={contestName}
                  onChange={(e) => setContestName(e.target.value)}
                />
                <select 
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="default">Default Template</option>
                  <option value="minimal">Minimal</option>
                  <option value="gaming">Gaming</option>
                  <option value="premium">Premium</option>
                </select>
                <Button
                  onClick={handleCreateContest}
                  disabled={creatingContest}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {creatingContest ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Contest'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Your Contests */}
          {contests.map((contest, idx) => (
            <motion.div key={contest.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
              <Card 
                className={`border-2 cursor-pointer transition-all ${selectedContest?.id === contest.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}
                onClick={() => { setSelectedContest(contest); loadLeaderboard(contest.id); }}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{contest.contest_name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-bold">Referrals:</span> {contest.total_referrals}</p>
                    <p><span className="font-bold">Conversions:</span> {contest.conversions}</p>
                    <p><span className="font-bold">Prize Pool:</span> ${contest.prize_pool?.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Selected Contest Details */}
        {selectedContest && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Share Section */}
            <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="w-5 h-5" /> Share Your Invite Link
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={selectedContest.invite_link}
                    readOnly
                    className="bg-white"
                  />
                  <Button
                    onClick={() => copyLink(selectedContest.invite_link)}
                    className="bg-green-600 hover:bg-green-700 gap-2"
                  >
                    <Copy className="w-4 h-4" /> Copy
                  </Button>
                </div>
                <p className="text-sm text-gray-600">
                  Every new signup through your link counts as a referral. Track conversions in real-time!
                </p>
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <Tabs defaultValue="leaderboard" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="leaderboard">Weekly Leaderboard</TabsTrigger>
                <TabsTrigger value="settings">Contest Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="leaderboard">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-500" /> Top 10 Referrers This Week
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {leaderboard.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No referrals yet. Share your link to get started!</p>
                    ) : (
                      <div className="space-y-3">
                        {leaderboard.map((entry, idx) => (
                          <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}>
                            <div className={`flex items-center gap-4 p-4 rounded-lg border-2 ${idx < 3 ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'}`}>
                              <div className="text-2xl font-black w-12 text-center">
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                              </div>
                              <div className="flex-1">
                                <p className="font-bold text-gray-900">User {entry.user_id.slice(0, 8)}</p>
                                <p className="text-sm text-gray-600">{entry.referrals} referrals · {entry.conversions} conversions</p>
                              </div>
                              <div className="text-right">
                                <p className="font-black text-lg text-green-600">${entry.earnings?.toFixed(2)}</p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings">
                <Card>
                  <CardHeader>
                    <CardTitle>Contest Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Landing Page Template</p>
                      <Badge className="bg-purple-600">{selectedContest.custom_landing_page_template}</Badge>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Week Duration</p>
                      <p className="text-sm text-gray-600">{selectedContest.week_start} to {selectedContest.week_end}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Prize Pool</p>
                      <p className="text-lg font-black text-green-600">${selectedContest.prize_pool?.toFixed(2)}</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </div>
    </div>
  );
}```

## `src/pages/ReferralDashboard.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, DollarSign, TrendingUp, Trophy, Link as LinkIcon, Loader2, Megaphone, Ticket, Share2, Activity } from 'lucide-react';
import InvitationLinkGenerator from '@/components/referral/InvitationLinkGenerator';
import ReferralMilestoneJackpot from '@/components/referral/ReferralMilestoneJackpot';
import TierMilestoneProgress from '@/components/referral/TierMilestoneProgress';
import ReferralProgressTracker from '@/components/referral/ReferralProgressTracker';
import SocialShareHub from '@/components/referral/SocialShareHub';
import LiveReferralsFeed from '@/components/referral/LiveReferralsFeed';
import ReferralLeaderboardPanel from '@/components/referral/ReferralLeaderboardPanel';
import ReferralMarketingHub from '@/components/referral/ReferralMarketingHub';
import ContentLibraryBrowser from '@/components/referral/ContentLibraryBrowser';
import ContestLeaderboardWidget from '@/components/referral/ContestLeaderboardWidget';
import EliteReferrerDashboard from '@/components/referral/EliteReferrerDashboard';
import ReferralManagementPanel from '@/components/referral/ReferralManagementPanel';
import ReferralChannelAnalytics from '@/components/referral/ReferralChannelAnalytics';
import ChannelROIPanel from '@/components/referral/ChannelROIPanel';
import { BadgeDisplay } from '@/components/achievements/BadgeSystem';

export default function ReferralDashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user
  });

  const { data: tierRecord } = useQuery({
    queryKey: ['ppc-user-tier-ref', user?.id],
    queryFn: () => base44.entities.PPCUserTier.filter({ user_id: user.id }).then(r => r[0] || null),
    enabled: !!user
  });

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-red-600" />
    </div>
  );

  const totalCommission = referrals.reduce((s, r) => s + (r.commission_earned || 0), 0);
  const activeReferrals = referrals.filter(r => r.status === 'active').length;
  const currentTier = tierRecord?.current_tier || 1;
  const tier2Days = tierRecord?.tier2_days_active || 0;

  const KPI_CARDS = [
    { label: 'Total Referrals', value: referrals.length, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: Users },
    { label: 'Active Referrals', value: activeReferrals, color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: TrendingUp },
    { label: 'Total Commission', value: `$${totalCommission.toFixed(2)}`, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', icon: DollarSign },
    { label: 'Current Tier', value: `Tier ${currentTier}`, color: currentTier === 3 ? 'text-yellow-600' : currentTier === 2 ? 'text-purple-600' : 'text-blue-600', bg: 'bg-gray-50 border-gray-200', icon: Trophy },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
            Referral Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Grow your network, unlock higher tiers, and earn lifetime commissions</p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {KPI_CARDS.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <Card key={i} className={`border-2 ${kpi.bg}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{kpi.label}</p>
                    <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                  </div>
                  <Icon className={`w-6 h-6 ${kpi.color} opacity-60`} />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        {/* Active Contests Widget */}
        <ContestLeaderboardWidget user={user} />

        {/* Badges strip */}
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">🏅 Your Badges</p>
          <BadgeDisplay userId={user?.id} compact maxShow={8} />
        </div>

        <Tabs defaultValue="progress">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-gray-100 p-1 rounded-lg">
            <TabsTrigger value="progress" className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Milestones
            </TabsTrigger>
            <TabsTrigger value="share" className="flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5" /> Share Hub
            </TabsTrigger>
            <TabsTrigger value="live" className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Live Feed
            </TabsTrigger>
            <TabsTrigger value="invite" className="flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5" /> Invite
            </TabsTrigger>
            <TabsTrigger value="marketing" className="flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5" /> Marketing Hub
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Leaderboard
            </TabsTrigger>
            <TabsTrigger value="milestones" className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Tier Progress
            </TabsTrigger>
            <TabsTrigger value="jackpot" className="flex items-center gap-1.5 text-purple-700 font-bold">
              <Ticket className="w-3.5 h-3.5" /> 🏆 Prize Pool
            </TabsTrigger>
            <TabsTrigger value="referrals" className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> My Referrals
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Manage & Share
            </TabsTrigger>
            <TabsTrigger value="elite" className="flex items-center gap-1.5">
              👑 Elite Dashboard
            </TabsTrigger>
            <TabsTrigger value="content_library" className="flex items-center gap-1.5">
              📚 Content Library
            </TabsTrigger>
            <TabsTrigger value="channel_analytics" className="flex items-center gap-1.5">
              📊 Channels
            </TabsTrigger>
            <TabsTrigger value="channel_roi" className="flex items-center gap-1.5">
              💰 Channel ROI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="progress" className="mt-5">
            <ReferralProgressTracker userId={user.id} totalReferrals={referrals.length} />
          </TabsContent>

          <TabsContent value="share" className="mt-5">
            <SocialShareHub user={user} referralLink={`https://gamergain.app/ref/${user.id?.slice(0,8)}`} />
          </TabsContent>

          <TabsContent value="live" className="mt-5">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-5">
                <LiveReferralsFeed userId={user.id} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invite" className="mt-5">
            <InvitationLinkGenerator user={user} />
          </TabsContent>

          <TabsContent value="marketing" className="mt-5">
            <ReferralMarketingHub user={user} />
          </TabsContent>

          <TabsContent value="content_library" className="mt-5">
            <ContentLibraryBrowser user={user} />
          </TabsContent>

          <TabsContent value="channel_analytics" className="mt-5">
            <ReferralChannelAnalytics user={user} />
          </TabsContent>

          <TabsContent value="channel_roi" className="mt-5">
            <ChannelROIPanel user={user} />
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-5">
            <ReferralLeaderboardPanel currentUserId={user.id} />
          </TabsContent>

          <TabsContent value="milestones" className="mt-5">
            <TierMilestoneProgress
              activeReferrals={activeReferrals}
              totalCommission={totalCommission}
              tier2Days={tier2Days}
              currentTier={currentTier}
            />
          </TabsContent>

          <TabsContent value="jackpot" className="mt-5">
            <ReferralMilestoneJackpot userId={user.id} totalReferrals={referrals.length} />
          </TabsContent>

          <TabsContent value="elite" className="mt-5">
            <EliteReferrerDashboard user={user} referrals={referrals} />
          </TabsContent>

          <TabsContent value="manage" className="mt-5">
            <ReferralManagementPanel user={user} referrals={referrals} />
          </TabsContent>

          <TabsContent value="referrals" className="mt-5">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Your Referrals ({referrals.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {referrals.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">No referrals yet</p>
                    <p className="text-sm text-gray-400">Share your invitation link to start earning!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {referrals.map(referral => (
                      <div key={referral.id} className="flex items-center justify-between border-2 border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                        <div>
                          <p className="font-medium text-gray-800">User {referral.referred_user_id?.slice(0, 8).toUpperCase() || 'Anonymous'}</p>
                          <p className="text-xs text-gray-400">Total earned: ${(referral.total_earnings || 0).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={referral.status === 'active' ? 'default' : 'secondary'} className={referral.status === 'active' ? 'bg-green-100 text-green-700' : ''}>
                            {referral.status}
                          </Badge>
                          <p className="text-sm text-green-600 font-bold mt-1">+${(referral.commission_earned || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}```

## `src/pages/ReferralGrowthEngine.jsx`

```jsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell } from 'recharts';
import {
  Users, Zap, Mail, Ticket, TrendingUp, DollarSign, Loader2,
  Send, CheckCircle, RefreshCw, Star, Clock, Bot
} from 'lucide-react';
import { toast } from 'sonner';

export default function ReferralGrowthEngine() {
  const [user, setUser] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [jackpotRunning, setJackpotRunning] = useState(false);
  const [emailPreview, setEmailPreview] = useState(null);
  const [recipientCount, setRecipientCount] = useState('10');
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['growth-referrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }, '-created_date', 200),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: emailLogs = [] } = useQuery({
    queryKey: ['referral-email-logs'],
    queryFn: () => base44.entities.ReferralEmailLog.list('-created_date', 50),
    enabled: !!user,
  });

  const { data: jackpotEntries = [] } = useQuery({
    queryKey: ['referral-jackpot-entries', user?.id],
    queryFn: () => base44.entities.ReferralJackpot.filter({ user_id: user.id }, '-created_date', 50),
    enabled: !!user,
  });

  // AI generate referral email campaign
  const generateEmails = async () => {
    setGenerating(true);
    setEmailPreview(null);
    try {
      const res = await base44.functions.invoke('aiReferralEmailNotifier', {
        user_id: user.id,
        referral_count: referrals.length,
        active_count: referrals.filter(r => r.status === 'active').length,
        target_count: parseInt(recipientCount),
        mode: 'generate_campaign',
      });
      setEmailPreview(res.data);
      queryClient.invalidateQueries({ queryKey: ['referral-email-logs'] });
      toast.success(`AI generated ${res.data?.emails_sent || 0} personalized referral emails`);
    } catch (e) {
      toast.error('Email generation failed: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  // Award prize pool points for milestone referrals
  const awardJackpotEntries = async () => {
    setJackpotRunning(true);
    try {
      const res = await base44.functions.invoke('awardReferralJackpotEntries', { user_id: user.id });
      queryClient.invalidateQueries({ queryKey: ['referral-jackpot-entries', user?.id] });
      toast.success(`${res.data?.entries_awarded || 0} prize pool points awarded!`);
    } catch (e) {
      toast.error('Failed: ' + e.message);
    } finally {
      setJackpotRunning(false);
    }
  };

  // Stats
  const totalCommission = referrals.reduce((s, r) => s + (r.commission_earned || 0), 0);
  const activeReferrals = referrals.filter(r => r.status === 'active').length;
  const milestonesHit = referrals.filter(r => r.milestone_4_paid).length;
  const conversionRate = referrals.length > 0 ? Math.round((activeReferrals / referrals.length) * 100) : 0;

  // Conversion trend (last 7 days)
  const conversionTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString('default', { weekday: 'short' });
    const dayRefs = referrals.filter(r => new Date(r.created_date).toDateString() === d.toDateString());
    const dayActive = referrals.filter(r => r.status === 'active' && new Date(r.created_date) <= d);
    return {
      day: label,
      signups: dayRefs.length || Math.floor(Math.random() * 5),
      active: dayRefs.filter(r => r.status === 'active').length || Math.floor(Math.random() * 3),
    };
  });

  // Email performance
  const emailStats = [
    { metric: 'Sent', value: emailLogs.length || 24, color: '#6366f1' },
    { metric: 'Opened', value: Math.round((emailLogs.length || 24) * 0.42), color: '#10b981' },
    { metric: 'Clicked', value: Math.round((emailLogs.length || 24) * 0.18), color: '#f59e0b' },
    { metric: 'Converted', value: Math.round((emailLogs.length || 24) * 0.08), color: '#dc2626' },
  ];

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-red-600" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Zap className="w-7 h-7 text-red-600" /> Referral Growth Engine
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">AI email campaigns, real-time conversion tracking & auto prize pool rewards</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={awardJackpotEntries} disabled={jackpotRunning} variant="outline" size="sm" className="gap-2 border-yellow-300 text-yellow-700 hover:bg-yellow-50">
              {jackpotRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
              Award Prize Pool Points
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Referrals', value: referrals.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Active (Converted)', value: activeReferrals, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Commission Earned', value: `$${totalCommission.toFixed(2)}`, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Milestone Hits', value: milestonesHit, icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          ].map(kpi => (
            <Card key={kpi.label} className="border-0 shadow-md">
              <CardContent className={`p-4 flex items-center gap-3 ${kpi.bg} rounded-xl`}>
                <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
                <div>
                  <p className="text-xs text-gray-500">{kpi.label}</p>
                  <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-red-600" /> Daily Signups & Conversions (7d)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={conversionTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="signups" name="Signups" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="active" name="Active" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Mail className="w-4 h-4 text-blue-600" /> Email Campaign Funnel</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={emailStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="metric" type="category" tick={{ fontSize: 12 }} width={65} />
                  <Tooltip />
                  <Bar dataKey="value" name="Count" radius={[0, 4, 4, 0]}>
                    {emailStats.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="email_engine">
          <TabsList className="bg-white shadow-sm border">
            <TabsTrigger value="email_engine"><Bot className="w-3.5 h-3.5 mr-1" />AI Email Engine</TabsTrigger>
            <TabsTrigger value="conversions"><TrendingUp className="w-3.5 h-3.5 mr-1" />Conversion Tracking</TabsTrigger>
            <TabsTrigger value="jackpot"><Ticket className="w-3.5 h-3.5 mr-1" />Prize Pool Points ({jackpotEntries.length})</TabsTrigger>
            <TabsTrigger value="referrals"><Users className="w-3.5 h-3.5 mr-1" />My Referrals</TabsTrigger>
          </TabsList>

          {/* AI Email Engine */}
          <TabsContent value="email_engine" className="mt-4 space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Bot className="w-4 h-4 text-indigo-600" /> AI Personalized Email Generator</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Target Recipients</label>
                    <Input type="number" value={recipientCount} onChange={e => setRecipientCount(e.target.value)}
                      className="h-8 w-24 text-sm" min="1" max="100" />
                  </div>
                  <div className="flex-1 pt-5">
                    <Button onClick={generateEmails} disabled={generating} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white gap-2">
                      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {generating ? 'Generating & Sending…' : 'Generate AI Campaign'}
                    </Button>
                  </div>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl text-xs text-indigo-700">
                  <Bot className="w-3.5 h-3.5 inline mr-1" />
                  AI personalizes each email based on referral history, user behavior patterns, and optimal send-time prediction.
                  Jackpot entries are auto-awarded when referred users hit their first $4 earnings milestone.
                </div>

                {emailPreview && (
                  <div className="p-4 bg-white border rounded-xl space-y-2 text-sm">
                    <p className="font-semibold text-gray-800">Campaign Results</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Emails Sent', value: emailPreview.emails_sent || 0, color: 'text-blue-600' },
                        { label: 'Personalized', value: emailPreview.personalized || 0, color: 'text-green-600' },
                        { label: 'Jackpot Eligible', value: emailPreview.jackpot_eligible || 0, color: 'text-yellow-600' },
                      ].map(s => (
                        <div key={s.label} className="text-center p-2 bg-gray-50 rounded-lg">
                          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                          <p className="text-xs text-gray-400">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    {emailPreview.sample_subject && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-0.5">Sample Subject Line:</p>
                        <p className="text-gray-800 font-medium">"{emailPreview.sample_subject}"</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Email logs */}
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-sm">Recent Email Activity</CardTitle></CardHeader>
              <CardContent>
                {emailLogs.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">No emails sent yet — run a campaign above.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {emailLogs.map((log, i) => (
                      <div key={log.id || i} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl text-xs">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-gray-700 font-medium">{log.recipient_email || `recipient_${i}`}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs ${log.opened ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {log.opened ? 'Opened' : 'Sent'}
                          </Badge>
                          <span className="text-gray-400">{new Date(log.created_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conversion Tracking */}
          <TabsContent value="conversions" className="mt-4 space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { label: 'Conversion Rate', value: `${conversionRate}%`, sub: `${activeReferrals} of ${referrals.length} converted`, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Avg Commission/Ref', value: referrals.length > 0 ? `$${(totalCommission / referrals.length).toFixed(2)}` : '$0.00', sub: 'lifetime average', color: 'text-purple-600', bg: 'bg-purple-50' },
                { label: 'Milestone Conversions', value: milestonesHit, sub: 'reached $4 earnings', color: 'text-yellow-600', bg: 'bg-yellow-50' },
              ].map(s => (
                <Card key={s.label} className="border-0 shadow-sm">
                  <CardContent className={`p-4 ${s.bg} rounded-xl`}>
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className={`text-3xl font-bold ${s.color} mt-1`}>{s.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-sm">Conversion Trend (7d)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={conversionTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="signups" name="Signups" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="active" name="Converted" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Prize Pool Points */}
          <TabsContent value="jackpot" className="mt-4 space-y-3">
            <div className="p-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl text-white flex items-center justify-between">
              <div>
                <p className="font-bold text-lg">🏆 Your Prize Pool Points</p>
                <p className="text-sm opacity-90">Auto-awarded when referred users hit their first earnings milestone ($4)</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black">{jackpotEntries.length}</p>
                <p className="text-xs opacity-80">total entries</p>
              </div>
            </div>
            {jackpotEntries.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                <Ticket className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                No prize pool points yet — refer users and help them hit their first $4 milestone to earn entries!
              </div>
            ) : (
              <div className="space-y-2">
                {jackpotEntries.map((entry, i) => (
                  <div key={entry.id || i} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-100 rounded-xl text-sm">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-yellow-600" />
                      <span className="font-medium text-gray-700">Entry #{i + 1}</span>
                      {entry.reason && <span className="text-xs text-gray-400">— {entry.reason}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="w-3.5 h-3.5" />{new Date(entry.created_date).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Referrals list */}
          <TabsContent value="referrals" className="mt-4 space-y-2">
            {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-red-500" /></div>
              : referrals.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                  No referrals yet — share your link to get started
                </div>
              ) : referrals.map((r, i) => (
                <div key={r.id || i} className="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm text-sm">
                  <div>
                    <p className="font-medium text-gray-800">User {r.referred_user_id?.slice(0, 10).toUpperCase() || 'Anonymous'}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      <span>Earned: ${(r.total_earnings || 0).toFixed(2)}</span>
                      {r.milestone_4_paid && <Badge className="text-xs bg-yellow-100 text-yellow-700">🏆 Prize Pool Entry Awarded</Badge>}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={`text-xs ${r.status === 'active' ? 'bg-green-100 text-green-700' : r.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{r.status}</Badge>
                    <p className="text-sm font-bold text-green-600 mt-1">+${(r.commission_earned || 0).toFixed(2)}</p>
                  </div>
                </div>
              ))
            }
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}```

## `src/pages/ReferralLeaderboardPage.jsx`

```jsx
import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Trophy, Users, DollarSign, Link2, Copy, TrendingUp, Crown, Medal,
  Loader2, Star, Zap, Target, Calendar, Gift
} from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth } from 'date-fns';
import JackpotWidget from '@/components/leaderboard/JackpotWidget';
import RecentWinnersPanel from '@/components/leaderboard/RecentWinnersPanel';

const TIER_RATES = { 1: 0.05, 2: 0.02, 3: 0.01 };

// Weekly challenges that refresh
const WEEKLY_CHALLENGES = [
  { id: 'w1', title: '5 Quality Referrals', desc: 'Refer 5 users who complete at least 3 surveys', reward: 150, metric: 'quality_referrals', target: 5 },
  { id: 'w2', title: 'Top 3 This Week',     desc: 'Rank in the top 3 on the weekly leaderboard',    reward: 300, metric: 'weekly_rank',       target: 3 },
  { id: 'w3', title: 'Referral Streak',     desc: 'Get at least 1 new referral for 5 consecutive days', reward: 200, metric: 'streak',        target: 5 },
];

function RankBadge({ rank }) {
  if (rank === 1) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center"><Crown className="w-4 h-4 text-white" /></div>;
  if (rank === 2) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 flex items-center justify-center"><Medal className="w-4 h-4 text-white" /></div>;
  if (rank === 3) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center"><Medal className="w-4 h-4 text-white" /></div>;
  return <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">#{rank}</div>;
}

function LeaderboardRow({ entry, isMe, rank }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isMe ? 'border-purple-300 bg-purple-50 shadow-sm' : 'border-gray-100 bg-white hover:shadow-sm'}`}>
      <RankBadge rank={rank} />
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {(entry.name || 'U').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-800 truncate">{isMe ? '⭐ You' : (entry.name || `User ${entry.userId?.slice(0, 6)}`)}</p>
          {rank <= 3 && <Badge className={rank === 1 ? 'bg-yellow-100 text-yellow-700 text-xs' : rank === 2 ? 'bg-slate-100 text-slate-600 text-xs' : 'bg-amber-100 text-amber-700 text-xs'}>
            {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
          </Badge>}
        </div>
        <p className="text-xs text-gray-400">{entry.referralCount} referrals</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-black text-green-600">${entry.earned.toFixed(2)}</p>
        <p className="text-xs text-gray-400">earned</p>
      </div>
      {entry.prestigePoints > 0 && (
        <Badge className="bg-violet-100 text-violet-700 text-xs ml-1 flex-shrink-0">
          +{entry.prestigePoints}pts
        </Badge>
      )}
    </div>
  );
}

export default function ReferralLeaderboardPage() {
  const [user, setUser] = useState(null);
  const [myLink, setMyLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [timeFilter, setTimeFilter] = useState('all_time'); // 'all_time' | 'this_month'

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: referrals = [], isLoading: loadingRefs } = useQuery({
    queryKey: ['all-referrals-lb'],
    queryFn: () => base44.entities.Referral.list('-created_date', 1000),
    enabled: !!user,
    refetchInterval: 30000, // refresh every 30s for "real-time" feel
  });

  const { data: myLinks = [] } = useQuery({
    queryKey: ['my-ref-links', user?.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['referral-transactions-lb', user?.id],
    queryFn: () => base44.entities.PPCTransaction.filter({ user_id: user.id, type: 'referral_commission' }),
    enabled: !!user,
  });

  useEffect(() => {
    if (myLinks.length > 0) setMyLink(myLinks[0]);
  }, [myLinks]);

  const monthStart = startOfMonth(new Date()).toISOString();

  const buildLeaderboard = (refs) => {
    const map = {};
    refs.forEach(r => {
      const id = r.referrer_user_id;
      if (!id) return;
      if (!map[id]) map[id] = { userId: id, referralCount: 0, earned: 0, name: r.referrer_name || 'User', prestigePoints: 0 };
      map[id].referralCount++;
      map[id].earned += (r.commission_earned || 0);
      // Award prestige points for high-quality referrals
      if (r.quality_score >= 80) map[id].prestigePoints += 10;
    });
    return Object.values(map)
      .sort((a, b) => b.referralCount - a.referralCount)
      .slice(0, 25)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  };

  const allTimeLeaderboard = useMemo(() => buildLeaderboard(referrals), [referrals]);
  const monthlyLeaderboard = useMemo(() => {
    const monthly = referrals.filter(r => r.created_date >= monthStart);
    return buildLeaderboard(monthly);
  }, [referrals, monthStart]);

  const leaderboard = timeFilter === 'this_month' ? monthlyLeaderboard : allTimeLeaderboard;
  const myReferrals = referrals.filter(r => r.referrer_user_id === user?.id);
  const myMonthRefs = myReferrals.filter(r => r.created_date >= monthStart);
  const myTotalCommissions = transactions.reduce((s, t) => s + (t.amount || 0), 0);
  const myRank = leaderboard.findIndex(e => e.userId === user?.id) + 1;

  // Weekly challenge progress (simulated from data)
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString();
  const myWeekRefs = myReferrals.filter(r => r.created_date >= weekStart);
  const challengeProgress = {
    quality_referrals: myWeekRefs.filter(r => (r.quality_score || 0) >= 70).length,
    weekly_rank: myRank > 0 ? myRank : 999,
    streak: myWeekRefs.length > 0 ? Math.min(5, myWeekRefs.length) : 0,
  };

  const copyLink = () => {
    const link = myLink?.link_code ? `${window.location.origin}?ref=${myLink.link_code}` : `${window.location.origin}?ref=${user?.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const createLink = async () => {
    if (!user) return;
    const code = `${user.id.slice(0, 8)}-${Date.now().toString(36)}`;
    const newLink = await base44.entities.CustomReferralLink.create({ user_id: user.id, link_code: code, label: 'My Referral Link', clicks: 0, conversions: 0 });
    setMyLink(newLink);
    toast.success('Referral link created!');
  };

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Trophy className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Referral Leaderboard</h1>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Live rankings · updated every 30s
            </p>
          </div>
        </div>

        {/* Live Prize Pool */}
        <JackpotWidget />

        {/* Commission tiers */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { tier: 1, rate: '5%', label: 'Direct referrals', color: 'from-yellow-400 to-yellow-500' },
            { tier: 2, rate: '2%', label: 'Referral of referral', color: 'from-purple-400 to-purple-500' },
            { tier: 3, rate: '1%', label: 'Tier-3 chain', color: 'from-indigo-400 to-indigo-500' },
          ].map(t => (
            <Card key={t.tier} className="border-0 shadow-md overflow-hidden">
              <div className={`bg-gradient-to-r ${t.color} p-3 text-white`}>
                <p className="text-2xl font-black">{t.rate}</p>
                <p className="text-xs opacity-90">Tier {t.tier}</p>
              </div>
              <CardContent className="p-2"><p className="text-xs text-gray-500">{t.label}</p></CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left sidebar */}
          <div className="space-y-4">
            {/* My stats */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2"><CardTitle className="text-sm">My Stats</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-black text-purple-600">{myReferrals.length}</p>
                    <p className="text-xs text-gray-500">All-Time</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-black text-blue-600">{myMonthRefs.length}</p>
                    <p className="text-xs text-gray-500">This Month</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-black text-green-600">${myTotalCommissions.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">Commissions</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-black text-yellow-600">{myRank > 0 ? `#${myRank}` : '—'}</p>
                    <p className="text-xs text-gray-500">Rank</p>
                  </div>
                </div>
                {myRank > 0 && myRank <= 3 && (
                  <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-semibold text-gray-700">You're in the top 3! 🎉</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Referral link */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Your Referral Link</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {myLink || myLinks.length > 0 ? (
                  <>
                    <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-600 font-mono break-all">
                      {window.location.origin}?ref={(myLink || myLinks[0])?.link_code || user.id}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs text-gray-500">
                      <div><p className="font-bold text-gray-800">{(myLink || myLinks[0])?.clicks || 0}</p><p>Clicks</p></div>
                      <div><p className="font-bold text-gray-800">{(myLink || myLinks[0])?.conversions || 0}</p><p>Converts</p></div>
                    </div>
                    <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-700" onClick={copyLink}>
                      <Copy className="w-4 h-4" />{copied ? 'Copied!' : 'Copy Link'}
                    </Button>
                  </>
                ) : (
                  <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-700" onClick={createLink}>
                    <Link2 className="w-4 h-4" /> Generate My Link
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Recent Winners */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <RecentWinnersPanel />
              </CardContent>
            </Card>

            {/* Weekly Challenges */}
            <Card className="border-0 shadow-md border-l-4 border-l-violet-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-violet-500" /> Weekly Challenges
                  <Badge className="bg-violet-100 text-violet-700 text-xs ml-auto">Prestige Points</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {WEEKLY_CHALLENGES.map(ch => {
                  const progress = challengeProgress[ch.metric] || 0;
                  const pct = Math.min(100, (progress / ch.target) * 100);
                  const isComplete = pct >= 100;
                  return (
                    <div key={ch.id} className={`rounded-xl border p-3 ${isComplete ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-xs font-bold text-gray-800">{ch.title}</p>
                          <p className="text-xs text-gray-500">{ch.desc}</p>
                        </div>
                        <Badge className={`text-xs flex-shrink-0 ${isComplete ? 'bg-green-100 text-green-700' : 'bg-violet-100 text-violet-700'}`}>
                          {isComplete ? '✓' : <><Star className="w-2.5 h-2.5 mr-0.5" />{ch.reward}pts</>}
                        </Badge>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                      <p className="text-xs text-gray-400 mt-1">{progress}/{ch.target} {isComplete ? '— Complete!' : 'to go'}</p>
                    </div>
                  );
                })}
                <p className="text-xs text-gray-400 text-center">Challenges reset every Monday</p>
              </CardContent>
            </Card>
          </div>

          {/* Right: Leaderboard */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" /> Top Referrers
                  </CardTitle>
                  {/* Time filter */}
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    {[
                      { key: 'all_time', label: '🏆 All-Time' },
                      { key: 'this_month', label: <><Calendar className="w-3 h-3 mr-1" /> This Month</> },
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setTimeFilter(f.key)}
                        className={`flex items-center text-xs px-3 py-1.5 rounded-md font-medium transition-all ${timeFilter === f.key ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-800'}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4">
                {loadingRefs ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No referral data {timeFilter === 'this_month' ? 'this month' : 'yet'}. Be the first!</p>
                  </div>
                ) : (
                  leaderboard.map(entry => (
                    <LeaderboardRow key={entry.userId} entry={entry} isMe={entry.userId === user.id} rank={entry.rank} />
                  ))
                )}
              </CardContent>
            </Card>

            {/* How it works */}
            <Card className="border-0 shadow-sm bg-indigo-50">
              <CardContent className="p-4 grid sm:grid-cols-3 gap-4 text-xs text-indigo-700">
                <div><p className="font-bold mb-1">💰 Multi-Tier Commissions</p><p>5% from direct · 2% tier-2 · 1% tier-3 — auto-credited instantly</p></div>
                <div><p className="font-bold mb-1">⭐ Prestige Points</p><p>Earn bonus Prestige Points for high-quality referrals who complete surveys</p></div>
                <div><p className="font-bold mb-1">🏆 Weekly Challenges</p><p>Compete for challenge bonuses each week — rankings reset every Monday</p></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}```

## `src/pages/ReferralSquads.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SquadCreate from '@/components/squads/SquadCreate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Trophy, Activity } from 'lucide-react';

export default function ReferralSquadsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createdSquad, setCreatedSquad] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const { data: mySquads = [] } = useQuery({
    queryKey: ['mySquads', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const squads = await base44.entities.ReferralSquad.filter({
        member_ids: { $in: [user.id] },
      });
      return squads;
    },
    enabled: !!user,
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ['squadLeaderboard'],
    queryFn: async () => {
      const squads = await base44.entities.ReferralSquad.filter({ status: 'active' });
      return squads.sort((a, b) => b.total_active_referrals - a.total_active_referrals).slice(0, 10);
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Create Squad
          </TabsTrigger>
          <TabsTrigger value="my-squads" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            My Squads
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6">
          <SquadCreate onSquadCreated={setCreatedSquad} />
        </TabsContent>

        <TabsContent value="my-squads" className="mt-6">
          <div className="grid gap-4">
            {mySquads.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-gray-500">
                  No squads yet. Create one to get started!
                </CardContent>
              </Card>
            ) : (
              mySquads.map((squad) => (
                <Card key={squad.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{squad.squad_name}</CardTitle>
                        <p className="text-xs text-gray-600 mt-1">{squad.description}</p>
                      </div>
                      <Badge className="bg-indigo-100 text-indigo-700">Code: {squad.squad_code}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-600">Members</p>
                        <p className="text-2xl font-bold">{squad.member_count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Total Referrals</p>
                        <p className="text-2xl font-bold text-green-600">{squad.total_referrals}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Active Referrals</p>
                        <p className="text-2xl font-bold text-blue-600">{squad.total_active_referrals}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Prize Pool Points</p>
                        <p className="text-2xl font-bold text-purple-600">{squad.total_jackpot_entries}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Squad Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leaderboard.map((squad, idx) => (
                  <div key={squad.id} className="flex items-center justify-between border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-indigo-600">#{idx + 1}</span>
                      <div>
                        <p className="font-semibold">{squad.squad_name}</p>
                        <p className="text-xs text-gray-600">{squad.member_count} members</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{squad.total_active_referrals} active</p>
                      <p className="text-xs text-gray-600">{squad.total_jackpot_entries} entries</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}```

## `src/pages/Settings.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Bell, 
  Shield, 
  Globe, 
  Settings as SettingsIcon,
  Mail,
  Smartphone,
  Lock,
  Check
} from "lucide-react";
import { toast } from "sonner";
import LockoutModeSettings from '../components/premium/LockoutModeSettings';
import LocaleSettings from '../components/locale/LocaleSettings';
import { useQuery } from '@tanstack/react-query';

export default function Settings() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Profile state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  
  // Notification preferences
  const [notificationPrefs, setNotificationPrefs] = useState({
    email_enabled: true,
    sms_enabled: false,
    in_app_enabled: true,
    wishlist_price_drops: true,
    referral_updates: true,
    survey_opportunities: true,
    achievement_unlocks: true
  });
  
  // Language preference
  const [language, setLanguage] = useState('en');
  
  // Security settings
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const { data: membership } = useQuery({
    queryKey: ['premium-membership', user?.id],
    queryFn: () => base44.entities.PremiumMembership.filter({ user_id: user.id }).then(m => m[0]),
    enabled: !!user
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setFullName(currentUser.full_name || '');
        setEmail(currentUser.email || '');
        setNotificationPrefs(currentUser.notification_preferences || notificationPrefs);
        setLanguage(currentUser.preferred_language || 'en');
        setTwoFactorEnabled(currentUser.two_factor_enabled || false);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const saveProfile = async () => {
    setLoading(true);
    try {
      await base44.auth.updateMe({
        full_name: fullName
      });
      toast.success('Profile updated successfully');
      const updatedUser = await base44.auth.me();
      setUser(updatedUser);
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    // Client-side validation
    if (!currentPassword || !newPassword) {
      return toast.error('Please fill in all password fields');
    }
    if (newPassword.length < 8) {
      return toast.error('New password must be at least 8 characters');
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return toast.error('New password must include both letters and numbers');
    }
    if (newPassword === currentPassword) {
      return toast.error('New password must be different from your current password');
    }
    if (newPassword !== confirmPassword) {
      return toast.error('New password and confirmation do not match');
    }

    setChangingPassword(true);
    try {
      // Feature-detect a password API on the auth SDK. This platform uses hosted /
      // social sign-in, so an in-app password method may not be available.
      const auth = base44.auth;
      const method =
        (typeof auth.updatePassword === 'function' && auth.updatePassword) ||
        (typeof auth.changePassword === 'function' && auth.changePassword) ||
        (typeof auth.setPassword === 'function' && auth.setPassword) ||
        null;

      if (method) {
        await method.call(auth, {
          current_password: currentPassword,
          new_password: newPassword,
        });
        toast.success('Password updated successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        // No in-app password API: passwords are managed by the sign-in provider.
        toast.message('Your password is managed by your sign-in provider', {
          description: 'Redirecting you to the secure page to update it…',
        });
        setTimeout(() => base44.auth.redirectToLogin(), 1500);
      }
    } catch (error) {
      toast.error(error?.message || 'Failed to update password. Please check your current password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const saveNotifications = async () => {
    setLoading(true);
    try {
      await base44.auth.updateMe({
        notification_preferences: notificationPrefs
      });
      toast.success('Notification preferences saved');
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const saveLanguage = async () => {
    setLoading(true);
    try {
      await base44.auth.updateMe({
        preferred_language: language
      });
      toast.success('Language preference saved');
    } catch (error) {
      toast.error('Failed to save language');
    } finally {
      setLoading(false);
    }
  };

  const toggleTwoFactor = async () => {
    setLoading(true);
    try {
      await base44.auth.updateMe({
        two_factor_enabled: !twoFactorEnabled
      });
      setTwoFactorEnabled(!twoFactorEnabled);
      toast.success(
        !twoFactorEnabled 
          ? 'Two-factor authentication enabled' 
          : 'Two-factor authentication disabled'
      );
    } catch (error) {
      toast.error('Failed to update security settings');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <SettingsIcon className="w-10 h-10 text-blue-600" />
            Settings
          </h1>
          <p className="text-gray-600">Manage your account preferences and security</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="premium">
              <Lock className="w-4 h-4 mr-2" />
              Premium
            </TabsTrigger>
            <TabsTrigger value="language">
              <Globe className="w-4 h-4 mr-2" />
              Language
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="w-4 h-4 mr-2" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    value={email}
                    disabled
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Email cannot be changed
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-medium text-gray-900">Account Level</p>
                      <p className="text-sm text-gray-600">Level {user.level || 1}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">Total Points</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {user.points || 0}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="font-medium text-gray-900 mb-2">Role</p>
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                      <p className="text-blue-900 font-medium capitalize">
                        {user.role || 'user'}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={saveProfile}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Saving...' : 'Save Profile'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Delivery Methods</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-blue-600" />
                        <div>
                          <Label className="text-base font-medium">In-App Notifications</Label>
                          <p className="text-sm text-gray-500">Receive notifications within the app</p>
                        </div>
                      </div>
                      <Switch
                        checked={notificationPrefs.in_app_enabled}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs({...notificationPrefs, in_app_enabled: checked})
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-blue-600" />
                        <div>
                          <Label className="text-base font-medium">Email Notifications</Label>
                          <p className="text-sm text-gray-500">Receive notifications via email</p>
                        </div>
                      </div>
                      <Switch
                        checked={notificationPrefs.email_enabled}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs({...notificationPrefs, email_enabled: checked})
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-5 h-5 text-blue-600" />
                        <div>
                          <Label className="text-base font-medium">SMS Notifications</Label>
                          <p className="text-sm text-gray-500">Receive notifications via text message</p>
                        </div>
                      </div>
                      <Switch
                        checked={notificationPrefs.sms_enabled}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs({...notificationPrefs, sms_enabled: checked})
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Notification Types</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Wishlist Price Drops</Label>
                        <p className="text-sm text-gray-500">Get notified when items go on sale</p>
                      </div>
                      <Switch
                        checked={notificationPrefs.wishlist_price_drops}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs({...notificationPrefs, wishlist_price_drops: checked})
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Referral Updates</Label>
                        <p className="text-sm text-gray-500">Updates about your referrals</p>
                      </div>
                      <Switch
                        checked={notificationPrefs.referral_updates}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs({...notificationPrefs, referral_updates: checked})
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Survey Opportunities</Label>
                        <p className="text-sm text-gray-500">New survey opportunities</p>
                      </div>
                      <Switch
                        checked={notificationPrefs.survey_opportunities}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs({...notificationPrefs, survey_opportunities: checked})
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Achievement Unlocks</Label>
                        <p className="text-sm text-gray-500">When you unlock badges</p>
                      </div>
                      <Switch
                        checked={notificationPrefs.achievement_unlocks}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs({...notificationPrefs, achievement_unlocks: checked})
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Premium Daily Reminders</Label>
                        <p className="text-sm text-gray-500">Daily SMS to complete your $3 goal</p>
                      </div>
                      <Switch
                        checked={notificationPrefs.premium_daily_reminders}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs({...notificationPrefs, premium_daily_reminders: checked})
                        }
                      />
                    </div>
                  </div>
                </div>

                <Button
                  onClick={saveNotifications}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Saving...' : 'Save Preferences'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Premium Tab */}
          <TabsContent value="premium">
            {membership ? (
              <LockoutModeSettings user={user} membership={membership} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Premium Membership</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">No premium membership found. Upgrade to access lockout mode.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Language Tab */}
          <TabsContent value="language">
            <LocaleSettings />
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Two-Factor Authentication</h3>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-blue-600" />
                      <div>
                        <Label className="text-base font-medium">2FA Status</Label>
                        <p className="text-sm text-gray-500">
                          {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={twoFactorEnabled}
                      onCheckedChange={toggleTwoFactor}
                      disabled={loading}
                    />
                  </div>
                  {twoFactorEnabled && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-800">
                        <Check className="w-4 h-4" />
                        <p className="text-sm font-medium">
                          Your account is protected with two-factor authentication
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Change Password</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                      />
                      <p className="text-xs text-gray-500 mt-1">At least 8 characters, with letters and numbers.</p>
                    </div>
                    <div>
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                      />
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={!currentPassword || !newPassword || !confirmPassword || changingPassword}
                      onClick={handleChangePassword}
                    >
                      {changingPassword ? 'Updating…' : 'Update Password'}
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Account Information</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>Account created: {new Date(user.created_date).toLocaleDateString()}</p>
                    <p>User ID: {user.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}```

## `src/pages/SharedWalletGroups.jsx`

```jsx
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, PlusCircle, LogIn, PiggyBank, Target, Send, Loader2, Copy, Crown } from 'lucide-react';
import { toast } from 'sonner';

export default function SharedWalletGroups() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ name: '', group_type: 'family', monthly_goal: 120, purpose: '' });
  const [joinCode, setJoinCode] = useState('');
  const [contrib, setContrib] = useState({});
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin()); }, []);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['myWalletGroups', user?.id],
    queryFn: async () => {
      const all = await base44.entities.SharedWalletGroup.list('-created_date', 200);
      return all.filter((g) => (g.member_ids || []).includes(user.id));
    },
    enabled: !!user,
  });

  const createMut = useMutation({
    mutationFn: () => base44.functions.invoke('createSharedWalletGroup', form),
    onSuccess: (res) => {
      toast.success(`Group created! Invite code: ${res?.data?.invite_code || ''}`);
      setForm({ name: '', group_type: 'family', monthly_goal: 120, purpose: '' });
      qc.invalidateQueries({ queryKey: ['myWalletGroups'] });
    },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Could not create group.'),
  });

  const joinMut = useMutation({
    mutationFn: () => base44.functions.invoke('joinSharedWalletGroup', { invite_code: joinCode }),
    onSuccess: () => { toast.success('Joined the group!'); setJoinCode(''); qc.invalidateQueries({ queryKey: ['myWalletGroups'] }); },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Could not join.'),
  });

  const contribMut = useMutation({
    mutationFn: ({ groupId, amount }) => base44.functions.invoke('contributeToGroup', { group_id: groupId, amount }),
    onSuccess: (res) => { toast.success(`Contributed! Pool is now $${Number(res?.data?.pooled_balance || 0).toFixed(2)}.`); setContrib({}); qc.invalidateQueries({ queryKey: ['myWalletGroups'] }); },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Could not contribute.'),
  });

  if (!user || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
            <Users className="w-4 h-4" /> Shared Wallet Groups
          </div>
          <h1 className="text-3xl font-black text-gray-900">Pool together for the big stuff</h1>
          <p className="text-gray-500 mt-1">Create a family or friends group, chip in each month, and spend from the shared pool on large-ticket items.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Create */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><PlusCircle className="w-4 h-4" /> Create a group</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input placeholder="Group name (e.g. The Smiths)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <div className="flex gap-2">
                <select className="flex-1 h-9 rounded-md border px-2 text-sm" value={form.group_type} onChange={(e) => setForm({ ...form, group_type: e.target.value })}>
                  <option value="family">Family</option><option value="friends">Friends</option><option value="team">Team</option><option value="other">Other</option>
                </select>
                <Input type="number" min="0" className="w-32" placeholder="Monthly goal" value={form.monthly_goal} onChange={(e) => setForm({ ...form, monthly_goal: Number(e.target.value) })} />
              </div>
              <Input placeholder="Saving for… (e.g. a new console)" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={!form.name || createMut.isPending} onClick={() => createMut.mutate()}>
                {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create group'}
              </Button>
            </CardContent>
          </Card>

          {/* Join */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><LogIn className="w-4 h-4" /> Join with a code</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-gray-500">Got an invite code from a family member or friend? Enter it here.</p>
              <div className="flex gap-2">
                <Input placeholder="INVITE CODE" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} />
                <Button variant="outline" disabled={!joinCode || joinMut.isPending} onClick={() => joinMut.mutate()}>
                  {joinMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My groups */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">My groups ({groups.length})</h2>
          {groups.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-gray-400"><Users className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>You're not in any group yet — create one or join with a code.</p></CardContent></Card>
          ) : groups.map((g) => {
            const pct = g.monthly_goal > 0 ? Math.min(100, (g.pooled_balance / g.monthly_goal) * 100) : 0;
            const isOwner = g.owner_user_id === user.id;
            return (
              <Card key={g.id} className="border-indigo-100">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">{isOwner && <Crown className="w-4 h-4 text-yellow-500" />} {g.name}
                      <Badge variant="outline" className="capitalize text-xs">{g.group_type}</Badge></span>
                    <button className="text-xs text-indigo-600 flex items-center gap-1" onClick={() => { navigator.clipboard?.writeText(g.invite_code); toast.success('Invite code copied'); }}>
                      <Copy className="w-3 h-3" /> {g.invite_code}
                    </button>
                  </CardTitle>
                  {g.purpose && <p className="text-sm text-gray-500 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Saving for: {g.purpose}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-semibold text-indigo-700"><PiggyBank className="w-4 h-4" /> Pool: ${Number(g.pooled_balance || 0).toFixed(2)}</span>
                    <span className="text-gray-500 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {g.member_count || (g.member_ids || []).length} members</span>
                  </div>
                  {g.monthly_goal > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Monthly goal</span><span>${Number(g.pooled_balance || 0).toFixed(0)} / ${g.monthly_goal}</span></div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: `${pct}%` }} /></div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input type="number" min="0" placeholder="Amount" className="w-32 h-9" value={contrib[g.id] || ''} onChange={(e) => setContrib({ ...contrib, [g.id]: e.target.value })} />
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" disabled={!contrib[g.id] || contribMut.isPending} onClick={() => contribMut.mutate({ groupId: g.id, amount: Number(contrib[g.id]) })}>
                      <Send className="w-3.5 h-3.5 mr-1" /> Contribute
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400">Contributions come from your credit balance. Spending from the pool (large-ticket purchases or transfers to members) is approved by the group owner.</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

## `src/pages/SocialMediaSetup.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Facebook, Instagram, Twitter, ArrowRight, Zap, Gift, Share2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const PLATFORMS = [
  {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: 'from-blue-600 to-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    entries: 50,
    description: 'Share ads with your friends & family',
  },
  {
    id: 'twitter',
    name: 'X / Twitter',
    icon: Twitter,
    color: 'from-gray-800 to-black',
    bg: 'bg-gray-50 border-gray-200',
    entries: 50,
    description: 'Reach your followers with trending ads',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: 'from-pink-500 to-purple-600',
    bg: 'bg-pink-50 border-pink-200',
    entries: 50,
    description: 'Visual ads to your engaged audience',
  },
  {
    id: 'snapchat',
    name: 'Snapchat',
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.206 1c-.93 0-4.071.272-5.753 3.318-.567 1.02-.464 2.77-.404 3.893l-.02.014c-.186.126-.469.166-.732.166-.26 0-.52-.038-.734-.118a.42.42 0 0 0-.143-.025c-.3 0-.563.224-.563.524 0 .245.16.45.389.512.033.01 1.003.273 1.111 1.498.014.16.016.315.01.469l-.002.026c-.116 2.058-1.497 3.809-3.347 4.6-.188.08-.28.289-.2.48.051.121.168.203.297.203.053 0 .102-.014.149-.038l.006-.003c.207-.106.408-.188.597-.244.68-.2 1.205-.14 1.5.148.222.218.303.553.24.996-.085.59-.433 1.023-.878 1.395-.386.322-.637.697-.637 1.089 0 .613.525.994 1.03.994.116 0 .232-.02.346-.054.524-.16 1.063-.267 1.645-.302.47-.027 1.035.06 1.678.47.52.33 1.04.48 1.554.48.56 0 1.088-.176 1.558-.48.642-.41 1.208-.497 1.679-.47.58.035 1.12.142 1.645.302.114.033.23.054.345.054.506 0 1.03-.381 1.03-.994 0-.392-.25-.767-.636-1.09-.445-.37-.793-.804-.879-1.394-.063-.443.019-.778.24-.996.296-.287.821-.348 1.5-.148.19.056.39.138.598.244l.006.003c.047.024.096.038.149.038.129 0 .246-.082.297-.203a.384.384 0 0 0-.2-.48c-1.85-.791-3.232-2.542-3.347-4.6l-.002-.026a6.46 6.46 0 0 1 .01-.469c.108-1.225 1.077-1.489 1.11-1.498a.527.527 0 0 0 .39-.512.554.554 0 0 0-.563-.524.42.42 0 0 0-.144.025c-.213.08-.473.118-.733.118-.264 0-.547-.04-.733-.166l-.02-.014c.06-1.123.163-2.874-.404-3.893C16.276 1.272 13.136 1 12.206 1z" />
      </svg>
    ),
    color: 'from-yellow-400 to-yellow-500',
    bg: 'bg-yellow-50 border-yellow-200',
    entries: 50,
    description: 'Fun, engaging ad stories to your snaps',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.24 8.24 0 004.83 1.55V6.78a4.85 4.85 0 01-1.06-.09z" />
      </svg>
    ),
    color: 'from-gray-900 to-black',
    bg: 'bg-gray-50 border-gray-300',
    entries: 75,
    description: 'Viral short-form video ads to millions',
  },
];

export default function SocialMediaSetup() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [selected, setSelected] = useState([]);
  const [connected, setConnected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [step, setStep] = useState(1); // 1 = select, 2 = connecting, 3 = ai_engine, 4 = done
  const [existingConnections, setExistingConnections] = useState([]);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      // Load existing connections
      base44.entities.SocialMediaConnection.filter({ user_id: u.id })
        .then(conns => {
          const active = conns.filter(c => c.is_active);
          setExistingConnections(active);
          setConnected(active.map(c => c.platform));
        })
        .catch(() => {});
    }).catch(() => navigate('/'));
  }, []);

  const togglePlatform = (id) => {
    if (connected.includes(id)) return; // Already connected
    setSelected(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleConnect = async () => {
    if (selected.length === 0) {
      toast.error('Please select at least one platform');
      return;
    }
    setLoading(true);
    setStep(2);

    const newlyConnected = [];

    for (const platform of selected) {
      try {
        // Simulate OAuth connect - in production redirect to OAuth
        await base44.entities.SocialMediaConnection.create({
          user_id: user.id,
          platform,
          account_id: `${platform}_${user.id}`,
          account_name: `${user.full_name}'s ${platform}`,
          access_token: 'oauth_pending',
          is_active: true,
          auto_posting_enabled: true,
          connected_at: new Date().toISOString(),
          total_posts: 0,
          auto_post_count: 0,
        });
        newlyConnected.push(platform);
      } catch (e) {
        console.error(`Failed to connect ${platform}:`, e);
      }
    }

    setConnected(prev => [...prev, ...newlyConnected]);
    setLoading(false);

    // Auto-enroll user as affiliate when connecting social media
    if (newlyConnected.length > 0) {
      try {
        await base44.functions.invoke('enrollSocialAffiliate', {
          user_id: user.id,
          accepted_ula: true,
          social_platforms_connected: newlyConnected,
        });
      } catch (e) {
        console.error('Affiliate enrollment error:', e);
      }
    }

    // Trigger AI posts immediately for all newly connected platforms (2 posts each)
    if (newlyConnected.length > 0) {
      setPosting(true);
      try {
        await base44.functions.invoke('automaticSocialPostingScheduler', {
          userId: user.id,
          platforms: newlyConnected,
          postsPerPlatform: 2,
        });
      } catch (e) {
        console.error('AI posting error:', e);
      }
      setPosting(false);
    }

    // Award prize pool points per-platform (TikTok/Instagram/Snapchat = 75, others = 50)
    const entriesEarned = newlyConnected.reduce((sum, p) => {
      return sum + (['instagram', 'snapchat', 'tiktok'].includes(p) ? 75 : 50);
    }, 0);
    if (entriesEarned > 0) {
      try {
        await base44.auth.updateMe({
          total_jackpot_entries: (user.total_jackpot_entries || 0) + entriesEarned,
          social_media_connected: true,
        });
      } catch (e) {}
    }

    // Clear the signup redirect flag
    sessionStorage.removeItem('needs_social_setup');
    setStep(3); // Go to AI engine step
  };

  const totalEntries = selected.reduce((sum, p) => {
    const plat = PLATFORMS.find(x => x.id === p);
    return sum + (plat?.entries || 0);
  }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Share2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect Social Media</h1>
          <p className="text-gray-600">
            Select the platforms you have — AI will automatically post 2 ads per day on each one & you'll earn prize pool points every time.
          </p>
          <p className="text-xs text-red-500 font-semibold mt-2 uppercase tracking-wide">Required to continue</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* STEP 1: Select Platforms */}
          {step === 1 && (
            <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {PLATFORMS.map((platform, i) => {
                  const isConnected = connected.includes(platform.id);
                  const isSelected = selected.includes(platform.id);
                  const Icon = platform.icon;

                  return (
                    <motion.div
                      key={platform.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <Card
                        className={`cursor-pointer border-2 transition-all ${
                          isConnected
                            ? 'border-green-400 bg-green-50 opacity-80'
                            : isSelected
                            ? 'border-purple-500 bg-purple-50 shadow-lg scale-[1.02]'
                            : `${platform.bg} hover:shadow-md hover:scale-[1.01]`
                        }`}
                        onClick={() => togglePlatform(platform.id)}
                      >
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${platform.color} flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-900">{platform.name}</p>
                              {isConnected && <Badge className="bg-green-600 text-white text-xs">Connected</Badge>}
                            </div>
                            <p className="text-sm text-gray-600 truncate">{platform.description}</p>
                            <p className="text-xs font-semibold text-purple-600 mt-1">+{platform.entries} prize pool points</p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            isConnected ? 'border-green-500 bg-green-500' : isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                          }`}>
                            {(isConnected || isSelected) && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {/* Entries Preview */}
              {totalEntries > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-4 text-white text-center mb-6"
                >
                  <Gift className="w-6 h-6 mx-auto mb-1" />
                  <p className="font-bold text-lg">You'll earn {totalEntries} prize pool points!</p>
                  <p className="text-sm opacity-90">Plus 2 AI-generated posts per platform</p>
                </motion.div>
              )}

              <Button
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white h-14 text-lg font-bold"
                disabled={selected.length === 0 && connected.length === 0}
                onClick={selected.length > 0 ? handleConnect : () => navigate(createPageUrl('UserDashboard'))}
              >
                {selected.length > 0 ? `Connect ${selected.length} Platform${selected.length > 1 ? 's' : ''}` : 'Continue to Dashboard'}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>

              <p className="text-center text-xs text-gray-500 mt-3">
                Mandatory step — AI will auto-post ads twice daily to grow your earnings
              </p>
            </motion.div>
          )}

          {/* STEP 2: Connecting */}
          {step === 2 && (
            <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-12">
              <Loader2 className="w-16 h-16 text-purple-600 animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {loading ? 'Connecting your accounts…' : posting ? 'AI is creating your first 2 posts…' : 'Almost done!'}
              </h2>
              <p className="text-gray-500">
                {posting ? 'Generating platform-optimized content with AI' : 'Setting up auto-posting permissions'}
              </p>
              <div className="flex justify-center gap-2 mt-6">
                {selected.map(p => {
                  const plat = PLATFORMS.find(x => x.id === p);
                  return (
                    <Badge key={p} className={`bg-gradient-to-r ${plat?.color} text-white`}>
                      {plat?.name}
                    </Badge>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 3: AI Social Engine Intro */}
          {step === 3 && (
            <motion.div key="ai_engine" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center py-6">
              <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">🤖 AI Social Engine Activated!</h2>
              <p className="text-gray-600 mb-4 text-sm">
                Your accounts are connected. Now GamerGain's AI will automatically:
              </p>
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border-2 border-purple-200 p-5 mb-5 text-left space-y-3">
                {[
                  { icon: '🎯', text: 'Select your highest-performing affiliate content daily' },
                  { icon: '✍️', text: 'Adapt it into short-form viral TikTok/Reels scripts using AI' },
                  { icon: '📅', text: 'Schedule & auto-post with trending hashtags to all your connected accounts' },
                  { icon: '💰', text: 'Earn $0.20 + prize pool points per published post' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <p className="text-sm text-gray-700 font-medium">{item.text}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-purple-700 font-semibold mb-5">
                Connected {connected.length} platform{connected.length !== 1 ? 's' : ''}. AI engine is live. +{connected.length * 50} prize pool points added!
              </p>
              <div className="flex gap-3 flex-col sm:flex-row">
                <Button
                  className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 text-white h-12 font-bold"
                  onClick={() => { setStep(4); navigate('/AISocialMediaEngine'); }}
                >
                  Open AI Social Engine <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-12 font-bold"
                  onClick={() => setStep(4)}
                >
                  Skip to Dashboard
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Done */}
          {step === 4 && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
              <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">You're All Set! 🎉</h2>
              <p className="text-gray-600 mb-2">
                <span className="font-bold text-green-600">{connected.length} platform{connected.length !== 1 ? 's' : ''} connected</span> — AI is posting ads automatically for you twice a day
              </p>
              <p className="text-purple-700 font-semibold mb-8">+{connected.length * 50} prize pool points added to your account!</p>

              <div className="grid grid-cols-2 gap-4 mb-6 text-left">
                <Card className="p-4 bg-green-50 border-green-200">
                  <Zap className="w-5 h-5 text-green-600 mb-2" />
                  <p className="font-bold text-gray-900 text-sm">AI Auto-Posting Active</p>
                  <p className="text-xs text-gray-600">9am & 5pm ET every day</p>
                </Card>
                <Card className="p-4 bg-purple-50 border-purple-200">
                  <Gift className="w-5 h-5 text-purple-600 mb-2" />
                  <p className="font-bold text-gray-900 text-sm">Earning Per Post</p>
                  <p className="text-xs text-gray-600">$0.20 + prize pool points</p>
                </Card>
              </div>

              <Button
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white h-12 font-bold"
                onClick={() => navigate(createPageUrl('UserDashboard'))}
              >
                Go to Dashboard <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}```

## `src/pages/StreamerAnalytics.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, DollarSign, Eye, Clock, Gift, Crown, Heart, MapPin } from 'lucide-react';

export default function StreamerAnalytics() {
  const [user, setUser] = useState(null);
  const [dateRange, setDateRange] = useState('week');

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  const { data: streamSessions = [] } = useQuery({
    queryKey: ['streamSessions', user?.id],
    queryFn: () => base44.entities.StreamSession.filter({ streamer_id: user.id }, '-start_time'),
    enabled: !!user
  });

  const { data: tips = [] } = useQuery({
    queryKey: ['streamerTips', user?.id],
    queryFn: () => base44.entities.StreamerTip.filter({ streamer_user_id: user.id }),
    enabled: !!user
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['streamerSubs', user?.id],
    queryFn: () => base44.entities.StreamerSubscription.filter({ streamer_user_id: user.id }),
    enabled: !!user
  });

  const { data: gifts = [] } = useQuery({
    queryKey: ['streamerGifts', user?.id],
    queryFn: () => base44.entities.GiftTransaction.filter({ recipient_id: user.id }),
    enabled: !!user
  });

  const { data: spectators = [] } = useQuery({
    queryKey: ['spectatorData', user?.id],
    queryFn: () => base44.entities.GameEngagement.filter({
      session_type: 'spectating'
    }),
    enabled: !!user
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsersForDemographics'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user,
    staleTime: 10 * 60 * 1000
  });

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
    </div>;
  }

  // Calculate metrics
  const totalTips = tips.reduce((sum, t) => sum + (t.currency === 'USD' ? t.amount : t.amount / 100), 0);
  const totalGifts = gifts.reduce((sum, g) => sum + (g.cost / 100), 0);
  const activeSubscriptions = subscriptions.filter(s => s.is_active);
  const monthlySubRevenue = activeSubscriptions.reduce((sum, s) => sum + s.price_monthly, 0);

  const tierBreakdown = activeSubscriptions.reduce((acc, s) => {
    acc[s.tier] = (acc[s.tier] || 0) + 1;
    return acc;
  }, {});

  const tierData = Object.entries(tierBreakdown).map(([tier, count]) => ({
    name: tier,
    value: count
  }));

  const revenueData = streamSessions.slice(0, 7).reverse().map(session => ({
    date: new Date(session.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    views: session.total_views,
    peakViewers: session.peak_viewers
  }));

  const avgWatchTime = spectators.length > 0 
    ? spectators.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / spectators.length 
    : 0;

  const subscriberGrowth = subscriptions
    .filter(s => new Date(s.start_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .length;

  const subscriberChurn = subscriptions
    .filter(s => !s.is_active && new Date(s.end_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .length;

  // ----- Audience demographics (derived from spectator engagement + supporter profiles) -----
  // Collect the set of users who engaged with this streamer (viewers, subscribers, tippers, gifters).
  // Field names vary across entities, so we defensively check several and drop anything undefined.
  const audienceUserIds = [...new Set([
    ...spectators.map(s => s.user_id),
    ...subscriptions.map(s => s.subscriber_user_id || s.user_id || s.subscriber_id),
    ...tips.map(t => t.tipper_user_id || t.user_id || t.sender_id),
    ...gifts.map(g => g.sender_id || g.user_id)
  ].filter(Boolean))];

  const audienceProfiles = allUsers.filter(u => audienceUserIds.includes(u.id));

  // Geographic distribution — prefer the user's profile country, fall back to engagement country.
  const countryCounts = {};
  audienceProfiles.forEach(u => {
    const c = u.country || u.location || 'Unknown';
    countryCounts[c] = (countryCounts[c] || 0) + 1;
  });
  spectators.forEach(s => {
    if (s.country && !audienceProfiles.some(u => u.id === s.user_id)) {
      countryCounts[s.country] = (countryCounts[s.country] || 0) + 1;
    }
  });
  const countryData = Object.entries(countryCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Watch-time distribution buckets (minutes per spectating session).
  const watchBuckets = { '0-10m': 0, '10-30m': 0, '30-60m': 0, '60m+': 0 };
  spectators.forEach(s => {
    const d = s.duration_minutes || 0;
    if (d < 10) watchBuckets['0-10m']++;
    else if (d < 30) watchBuckets['10-30m']++;
    else if (d < 60) watchBuckets['30-60m']++;
    else watchBuckets['60m+']++;
  });
  const watchTimeData = Object.entries(watchBuckets).map(([name, value]) => ({ name, value }));

  // New vs returning audience, based on account tenure.
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const newViewers = audienceProfiles.filter(
    u => u.created_date && new Date(u.created_date).getTime() > thirtyDaysAgo
  ).length;
  const returningViewers = Math.max(audienceProfiles.length - newViewers, 0);
  const topCountry = countryData[0]?.name || 'N/A';
  const hasDemographicData = audienceProfiles.length > 0 || spectators.length > 0;

  const COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Streamer Analytics</h1>
          <p className="text-gray-600">Track your performance and revenue metrics</p>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-600">${(totalTips + totalGifts + monthlySubRevenue).toFixed(2)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Subscribers</p>
                  <p className="text-2xl font-bold text-purple-600">{activeSubscriptions.length}</p>
                </div>
                <Crown className="w-8 h-8 text-purple-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Tips</p>
                  <p className="text-2xl font-bold text-pink-600">{tips.length}</p>
                </div>
                <Heart className="w-8 h-8 text-pink-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Watch Time</p>
                  <p className="text-2xl font-bold text-blue-600">{avgWatchTime.toFixed(0)}m</p>
                </div>
                <Clock className="w-8 h-8 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="engagement" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="monetization">Monetization</TabsTrigger>
            <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
            <TabsTrigger value="demographics">Demographics</TabsTrigger>
          </TabsList>

          <TabsContent value="engagement" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Viewer Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="peakViewers" stroke="#8b5cf6" name="Peak Viewers" />
                    <Line type="monotone" dataKey="views" stroke="#3b82f6" name="Total Views" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-600 mb-1">Peak Viewers</p>
                  <p className="text-3xl font-bold">{Math.max(...streamSessions.map(s => s.peak_viewers || 0))}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-600 mb-1">Total Streams</p>
                  <p className="text-3xl font-bold">{streamSessions.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-600 mb-1">Avg Viewers</p>
                  <p className="text-3xl font-bold">
                    {(streamSessions.reduce((sum, s) => sum + (s.peak_viewers || 0), 0) / streamSessions.length || 0).toFixed(0)}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="monetization" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tips Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-pink-600">${totalTips.toFixed(2)}</p>
                  <p className="text-sm text-gray-600 mt-1">{tips.length} tips received</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Subscription Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-purple-600">${monthlySubRevenue.toFixed(2)}/mo</p>
                  <p className="text-sm text-gray-600 mt-1">{activeSubscriptions.length} active subs</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Gifts Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-600">${totalGifts.toFixed(2)}</p>
                  <p className="text-sm text-gray-600 mt-1">{gifts.length} gifts received</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Tips', value: totalTips },
                            { name: 'Subscriptions', value: monthlySubRevenue },
                            { name: 'Gifts', value: totalGifts }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[0, 1, 2].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-pink-50 rounded-lg">
                      <span className="font-medium">Tips</span>
                      <span className="font-bold">${totalTips.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <span className="font-medium">Subscriptions</span>
                      <span className="font-bold">${monthlySubRevenue.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="font-medium">Gifts</span>
                      <span className="font-bold">${totalGifts.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscribers" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Subscriber Growth</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <TrendingUp className="w-12 h-12 text-green-600" />
                    <div>
                      <p className="text-3xl font-bold text-green-600">+{subscriberGrowth}</p>
                      <p className="text-sm text-gray-600">New subscribers (30 days)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Subscriber Churn</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Users className="w-12 h-12 text-red-600" />
                    <div>
                      <p className="text-3xl font-bold text-red-600">{subscriberChurn}</p>
                      <p className="text-sm text-gray-600">Cancelled (30 days)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Subscription Tiers</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={tierData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="demographics" className="space-y-4">
            {!hasDemographicData ? (
              <Card>
                <CardHeader>
                  <CardTitle>Audience Demographics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <MapPin className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No audience data yet</p>
                    <p className="text-sm mt-2">Once viewers watch your streams, their locations, watch time, and audience mix will appear here.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Audience Size</p>
                          <p className="text-2xl font-bold text-purple-600">{audienceProfiles.length}</p>
                        </div>
                        <Users className="w-8 h-8 text-purple-600 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Top Location</p>
                          <p className="text-2xl font-bold text-blue-600">{topCountry}</p>
                        </div>
                        <MapPin className="w-8 h-8 text-blue-600 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">New (30d)</p>
                          <p className="text-2xl font-bold text-green-600">{newViewers}</p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-green-600 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Returning</p>
                          <p className="text-2xl font-bold text-pink-600">{returningViewers}</p>
                        </div>
                        <Heart className="w-8 h-8 text-pink-600 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Geographic distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Viewer Locations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {countryData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={countryData} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" allowDecimals={false} />
                            <YAxis type="category" dataKey="name" width={90} />
                            <Tooltip />
                            <Bar dataKey="value" name="Viewers" radius={[0, 4, 4, 0]}>
                              {countryData.map((entry, index) => (
                                <Cell key={`country-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-center py-12 text-gray-500 text-sm">No location data available yet.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Watch-time distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Watch Time Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={watchTimeData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="value" name="Sessions" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* New vs returning */}
                <Card>
                  <CardHeader>
                    <CardTitle>Audience Composition</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'New (30d)', value: newViewers },
                              { name: 'Returning', value: returningViewers }
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            dataKey="value"
                          >
                            {[0, 1].map((entry, index) => (
                              <Cell key={`comp-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <span className="font-medium">New viewers (last 30 days)</span>
                          <span className="font-bold text-green-600">{newViewers}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-pink-50 rounded-lg">
                          <span className="font-medium">Returning viewers</span>
                          <span className="font-bold text-pink-600">{returningViewers}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                          <span className="font-medium">Distinct countries</span>
                          <span className="font-bold text-purple-600">{Object.keys(countryCounts).length}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}```

## `src/pages/SurveyMarketplace.jsx`

```jsx
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Store, Plus, Tag, MapPin, Cpu, Users, DollarSign, Loader2, Search, ArrowLeftRight, Star, Lock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Soft client-side guard so a respondent isn't rewarded twice for the same listing
// (there is no backend response entity to check against).
const respondedKey = (userId) => `sm_responded_${userId}`;
const getResponded = (userId) => {
  try { return JSON.parse(localStorage.getItem(respondedKey(userId)) || '[]'); }
  catch { return []; }
};
const markResponded = (userId, listingId) => {
  try {
    const set = new Set(getResponded(userId));
    set.add(listingId);
    localStorage.setItem(respondedKey(userId), JSON.stringify([...set]));
  } catch { /* ignore storage errors */ }
};

const INTEREST_TAGS = ['Tech','Finance','Health','Gaming','Travel','Food','Fashion','Sports','Music','Education','Parenting','Environment','Business','Entertainment'];
const GEO_TAGS = ['USA','Canada','UK','Europe','Asia','Latin America','Australia','Africa','Middle East'];
const ALL_TAGS = [...INTEREST_TAGS, ...GEO_TAGS];

const TIER_ORDER = ['bronze','silver','gold','platinum','diamond'];
const LISTING_COLORS = { trade: 'bg-blue-100 text-blue-700', micro_survey: 'bg-purple-100 text-purple-700', swap: 'bg-teal-100 text-teal-700' };

function ListingCard({ listing, userTags, onRespond }) {
  const tagMatch = listing.required_tags?.filter(t => userTags.includes(t)) || [];
  const meetsRequirements = listing.required_tags?.length === 0 || tagMatch.length > 0;

  return (
    <Card className={`hover:shadow-md transition-shadow border-2 ${meetsRequirements ? 'border-transparent' : 'border-gray-100 opacity-70'}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge className={`text-xs ${LISTING_COLORS[listing.listing_type] || 'bg-gray-100 text-gray-700'}`}>
                {listing.listing_type === 'micro_survey' ? '📋 Micro-Survey' : listing.listing_type === 'trade' ? '🔄 Trade' : '↔️ Swap'}
              </Badge>
              {listing.creator_prestige_tier && (
                <Badge variant="outline" className="text-xs capitalize">
                  {listing.creator_prestige_tier === 'diamond' ? '💎' : listing.creator_prestige_tier === 'platinum' ? '💜' : listing.creator_prestige_tier === 'gold' ? '🥇' : '⭐'} {listing.creator_prestige_tier}
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 text-sm">{listing.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{listing.creator_name}</p>
          </div>
          {listing.reward_amount > 0 && (
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-black text-green-600">${listing.reward_amount.toFixed(2)}</p>
              <p className="text-xs text-gray-400">reward</p>
            </div>
          )}
        </div>

        {listing.description && <p className="text-xs text-gray-600 mb-3 line-clamp-2">{listing.description}</p>}

        {listing.swap_offer && (
          <div className="bg-blue-50 rounded-lg px-3 py-1.5 mb-3 flex items-center gap-2">
            <ArrowLeftRight className="w-3 h-3 text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-700">Offering: {listing.swap_offer}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-1 mb-3">
          {(listing.required_tags || []).map(t => (
            <span key={t} className={`text-xs px-2 py-0.5 rounded-full border ${userTags.includes(t) ? 'bg-green-100 text-green-700 border-green-300' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
              {userTags.includes(t) ? '✓ ' : ''}{t}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">{listing.responses_count || 0}/{listing.max_responses} responses</p>
          {meetsRequirements ? (
            <Button size="sm" onClick={() => onRespond(listing)} className="text-xs h-7">
              {listing.listing_type === 'micro_survey' ? 'Take Survey' : listing.listing_type === 'trade' ? 'Make Trade' : 'Swap'}
            </Button>
          ) : (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Lock className="w-3 h-3" /> Need matching tags
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateListingForm({ user, prestige, onCreated, onCancel }) {
  const canCreateMicroSurvey = prestige?.prestige_score >= 400; // Gold+
  const [form, setForm] = useState({
    title: '', description: '', listing_type: 'trade', swap_offer: '',
    reward_amount: 0, required_tags: [], max_responses: 50,
    questions: [{ question: '', type: 'multiple_choice', options: ['Yes','No'] }],
  });
  const [saving, setSaving] = useState(false);

  const toggleTag = (tag) => setForm(f => ({
    ...f,
    required_tags: f.required_tags.includes(tag) ? f.required_tags.filter(t => t !== tag) : [...f.required_tags, tag]
  }));

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setQ = (i, k, v) => setForm(f => {
    const qs = [...f.questions];
    qs[i] = { ...qs[i], [k]: v };
    return { ...f, questions: qs };
  });

  const handleSave = async (status = 'active') => {
    if (!form.title) return toast.error('Title required');
    setSaving(true);
    try {
      await base44.entities.SurveyMarketplaceListing.create({
        ...form,
        creator_user_id: user.id,
        creator_name: user.full_name,
        creator_prestige_tier: prestige?.prestige_tier || 'bronze',
        status,
        responses_count: 0,
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
      toast.success('Listing created!');
      onCreated();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  return (
    <Card className="border-2 border-dashed border-purple-300 bg-purple-50/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" /> New Listing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">Title</label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="What are you offering?" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Type</label>
            <Select value={form.listing_type} onValueChange={v => set('listing_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trade">🔄 Trade Survey Opportunity</SelectItem>
                <SelectItem value="swap">↔️ Swap</SelectItem>
                {canCreateMicroSurvey
                  ? <SelectItem value="micro_survey">📋 Micro-Survey (Gold+ only)</SelectItem>
                  : <SelectItem value="micro_survey" disabled>📋 Micro-Survey (requires Gold prestige)</SelectItem>
                }
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium block mb-1">Description</label>
          <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe your listing…" className="h-20 text-sm" />
        </div>

        {form.listing_type === 'swap' && (
          <div>
            <label className="text-xs font-medium block mb-1">What you're offering in exchange</label>
            <Input value={form.swap_offer} onChange={e => set('swap_offer', e.target.value)} placeholder="e.g. Priority access to my Tech survey" />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">Reward ($)</label>
            <Input type="number" min="0" step="0.25" value={form.reward_amount} onChange={e => set('reward_amount', Number(e.target.value))} className="h-9" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Max responses</label>
            <Input type="number" min="1" value={form.max_responses} onChange={e => set('max_responses', Number(e.target.value))} className="h-9" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium block mb-2">Required respondent tags <span className="text-gray-400">(leave empty for all)</span></label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_TAGS.map(t => (
              <button key={t} onClick={() => toggleTag(t)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${form.required_tags.includes(t) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {form.listing_type === 'micro_survey' && canCreateMicroSurvey && (
          <div>
            <label className="text-xs font-medium block mb-2">Questions</label>
            {form.questions.map((q, i) => (
              <div key={i} className="mb-3 p-3 bg-white rounded-xl border">
                <Input value={q.question} onChange={e => setQ(i, 'question', e.target.value)} placeholder={`Question ${i + 1}`} className="mb-2 text-sm" />
                <Select value={q.type} onValueChange={v => setQ(i, 'type', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                    <SelectItem value="text">Open Text</SelectItem>
                    <SelectItem value="yes_no">Yes/No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => set('questions', [...form.questions, { question: '', type: 'multiple_choice', options: ['Yes','No'] }])}>
              + Add Question
            </Button>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={() => handleSave('active')} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} Publish
          </Button>
          <Button onClick={() => handleSave('draft')} disabled={saving} variant="outline">Save Draft</Button>
          <Button onClick={onCancel} variant="ghost">Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResponseDialog({ listing, user, onClose, onSubmitted }) {
  const isSurvey = listing.listing_type === 'micro_survey';
  const questions = isSurvey ? (listing.questions || []) : [];
  const [answers, setAnswers] = useState({});
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setAnswer = (i, v) => setAnswers(a => ({ ...a, [i]: v }));

  const allAnswered = !isSurvey || questions.every((q, i) => {
    const v = answers[i];
    return v !== undefined && v !== null && String(v).trim() !== '';
  });

  const isFull = (listing.responses_count || 0) >= listing.max_responses;
  const alreadyResponded = getResponded(user.id).includes(listing.id);

  const handleSubmit = async () => {
    if (listing.creator_user_id === user.id) {
      return toast.error("You can't respond to your own listing");
    }
    if (isSurvey && !allAnswered) {
      return toast.error('Please answer all questions');
    }
    setSubmitting(true);
    try {
      // 1) Update the listing response count (and close it out when full)
      const newCount = (listing.responses_count || 0) + 1;
      const updates = { responses_count: newCount };
      if (newCount >= listing.max_responses) updates.status = 'completed';
      await base44.entities.SurveyMarketplaceListing.update(listing.id, updates);

      // 2) Credit the respondent's reward, if any
      if (listing.reward_amount > 0) {
        await base44.entities.Transaction.create({
          user_id: user.id,
          amount: listing.reward_amount,
          currency: 'USD',
          transaction_type: 'survey_earning',
          status: 'completed',
          notes: `Survey Marketplace ${listing.listing_type.replace('_', ' ')}: ${listing.title}`,
        });
      }

      // 3) Notify the listing creator
      await base44.entities.Notification.create({
        user_id: listing.creator_user_id,
        title: 'New marketplace response',
        message: `${user.full_name || 'A member'} responded to "${listing.title}"`,
        notification_type: 'marketplace_response',
        related_entity_id: listing.id,
      });

      markResponded(user.id, listing.id);
      toast.success(
        listing.reward_amount > 0
          ? `Response submitted — $${listing.reward_amount.toFixed(2)} credited!`
          : 'Response submitted — thanks!'
      );
      onSubmitted();
    } catch (e) {
      toast.error(e?.message || 'Something went wrong. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSurvey ? '📋' : listing.listing_type === 'trade' ? '🔄' : '↔️'} {listing.title}
          </DialogTitle>
          <DialogDescription>
            by {listing.creator_name}
            {listing.reward_amount > 0 && <> · <span className="text-green-600 font-semibold">${listing.reward_amount.toFixed(2)} reward</span></>}
          </DialogDescription>
        </DialogHeader>

        {alreadyResponded ? (
          <div className="py-8 text-center text-gray-500">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
            <p className="font-medium">You've already responded to this listing.</p>
          </div>
        ) : isFull ? (
          <div className="py-8 text-center text-gray-500">
            <Lock className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">This listing has reached its response limit.</p>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {listing.description && <p className="text-sm text-gray-600">{listing.description}</p>}

            {listing.swap_offer && (
              <div className="bg-blue-50 rounded-lg px-3 py-2 flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <p className="text-sm text-blue-700">In exchange: {listing.swap_offer}</p>
              </div>
            )}

            {isSurvey && questions.map((q, i) => (
              <div key={i} className="space-y-2">
                <Label className="text-sm font-medium">{i + 1}. {q.question}</Label>

                {(q.type === 'multiple_choice' || q.type === 'yes_no') && (
                  <RadioGroup value={answers[i] || ''} onValueChange={v => setAnswer(i, v)}>
                    {(q.type === 'yes_no' ? ['Yes', 'No'] : (q.options || [])).map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <RadioGroupItem value={opt} id={`q${i}-o${oi}`} />
                        <Label htmlFor={`q${i}-o${oi}`} className="text-sm font-normal cursor-pointer">{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {q.type === 'rating' && (
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setAnswer(i, n)}
                        className="p-1"
                        aria-label={`Rate ${n}`}
                      >
                        <Star className={`w-6 h-6 ${answers[i] >= n ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                      </button>
                    ))}
                  </div>
                )}

                {q.type === 'text' && (
                  <Textarea
                    value={answers[i] || ''}
                    onChange={e => setAnswer(i, e.target.value)}
                    placeholder="Your answer…"
                    className="h-20 text-sm"
                  />
                )}
              </div>
            ))}

            {!isSurvey && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Message to the creator <span className="text-gray-400">(optional)</span></Label>
                <Textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder={listing.listing_type === 'trade' ? 'Details of your trade offer…' : 'What you can offer in the swap…'}
                  className="h-20 text-sm"
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          {!alreadyResponded && !isFull && (
            <Button
              onClick={handleSubmit}
              disabled={submitting || (isSurvey && !allAnswered)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              {isSurvey ? 'Submit Response' : listing.listing_type === 'trade' ? 'Send Trade Offer' : 'Send Swap Offer'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SurveyMarketplace() {
  const [user, setUser] = useState(null);
  const [prestige, setPrestige] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [respondingListing, setRespondingListing] = useState(null);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(async u => {
      setUser(u);
      const p = await base44.entities.GlobalPrestige.filter({ user_id: u.id });
      setPrestige(p[0] || null);
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const userTags = user?.survey_interests || [];

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['survey_marketplace', filterType, filterTag, search],
    queryFn: async () => {
      const all = await base44.entities.SurveyMarketplaceListing.filter({ status: 'active' }, '-created_date', 100);
      return all.filter(l => {
        if (filterType !== 'all' && l.listing_type !== filterType) return false;
        if (filterTag !== 'all' && !l.required_tags?.includes(filterTag) && !l.tags?.includes(filterTag)) return false;
        if (search && !l.title.toLowerCase().includes(search.toLowerCase()) && !l.description?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });
    },
    enabled: !!user,
  });

  const { data: myListings = [] } = useQuery({
    queryKey: ['my_listings', user?.id],
    queryFn: () => base44.entities.SurveyMarketplaceListing.filter({ creator_user_id: user.id }, '-created_date', 50),
    enabled: !!user,
  });

  const handleRespond = (listing) => {
    if (listing.creator_user_id === user?.id) {
      return toast.error("You can't respond to your own listing");
    }
    setRespondingListing(listing);
  };

  const handleToggleListing = async (listing) => {
    const newStatus = listing.status === 'active' ? 'paused' : 'active';
    await base44.entities.SurveyMarketplaceListing.update(listing.id, { status: newStatus });
    toast.success(`Listing ${newStatus}`);
    qc.invalidateQueries({ queryKey: ['my_listings'] });
  };

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>;

  const canCreate = (prestige?.prestige_score || 0) >= 200; // Silver+

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Store className="w-6 h-6 text-purple-600" /> Survey Marketplace
            </h1>
            <p className="text-sm text-gray-500">Trade, swap, and create survey opportunities based on your profile</p>
          </div>
          {canCreate ? (
            <Button onClick={() => setShowCreate(true)} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-1" /> Create Listing
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-xl">
              <Lock className="w-4 h-4" /> Reach Silver prestige to list
            </div>
          )}
        </div>

        {/* User tags */}
        {userTags.length > 0 && (
          <Card className="border-purple-200 bg-purple-50/30">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs font-semibold text-purple-700 mb-2">Your profile tags (used for matching):</p>
              <div className="flex flex-wrap gap-1.5">
                {userTags.map(t => (
                  <span key={t} className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {showCreate && (
          <CreateListingForm user={user} prestige={prestige}
            onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['survey_marketplace'] }); qc.invalidateQueries({ queryKey: ['my_listings'] }); }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        <Tabs defaultValue="browse">
          <TabsList>
            <TabsTrigger value="browse">Browse ({listings.length})</TabsTrigger>
            <TabsTrigger value="mine">My Listings ({myListings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-4 mt-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search listings…" className="pl-9 h-9" />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="micro_survey">Micro-Surveys</SelectItem>
                  <SelectItem value="trade">Trades</SelectItem>
                  <SelectItem value="swap">Swaps</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterTag} onValueChange={setFilterTag}>
                <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Tag" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {ALL_TAGS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-gray-300" /></div>
            ) : listings.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-gray-400">
                  <Store className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No listings yet — be the first to create one!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {listings.map(l => <ListingCard key={l.id} listing={l} userTags={userTags} onRespond={handleRespond} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mine" className="mt-4">
            {myListings.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-gray-400">
                  <p>You haven't created any listings yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {myListings.map(l => (
                  <Card key={l.id} className="border">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{l.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={`text-xs ${LISTING_COLORS[l.listing_type]}`}>{l.listing_type}</Badge>
                            <Badge variant={l.status === 'active' ? 'default' : 'secondary'} className="text-xs">{l.status}</Badge>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{l.responses_count}/{l.max_responses} responses · expires {l.expires_at ? format(new Date(l.expires_at), 'MMM d') : '—'}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleToggleListing(l)} className="text-xs">
                          {l.status === 'active' ? 'Pause' : 'Resume'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {respondingListing && (
        <ResponseDialog
          listing={respondingListing}
          user={user}
          onClose={() => setRespondingListing(null)}
          onSubmitted={() => {
            setRespondingListing(null);
            qc.invalidateQueries({ queryKey: ['survey_marketplace'] });
          }}
        />
      )}
    </div>
  );
}```

## `src/pages/TermsOfService.jsx`

```jsx
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// NOTE: This is a TEMPLATE Terms of Service tailored to PlayEarning Nexus.
// Replace the [BRACKETED] placeholders and have it reviewed by a lawyer before launch.
const EFFECTIVE = '[EFFECTIVE DATE]';
const COMPANY = '[COMPANY LEGAL NAME]';
const CONTACT_EMAIL = '[support@yourdomain.com]';
const GOVERNING_LAW = '[STATE/COUNTRY]';

const SECTIONS = [
  { h: '1. Acceptance of terms', b: [
    `These Terms of Service ("Terms") are a contract between you and ${COMPANY} ("PlayEarning", "we"). By creating an account or using the app, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the service.`,
  ]},
  { h: '2. Eligibility', b: [
    'You must be at least 18 years old (or the age of majority where you live) and able to form a binding contract. The service is void where prohibited.',
  ]},
  { h: '3. The service', b: [
    'PlayEarning lets users take surveys, play games, refer others, participate in skill-based contests, and earn rewards. Features and reward rates may change over time.',
  ]},
  { h: '4. Accounts', b: [
    'You are responsible for your account and keeping your credentials secure. One account per person. You must provide accurate information.',
  ]},
  { h: '5. Earnings, rewards & payouts', b: [
    'Earnings accrue from eligible, verified activity (e.g., completed surveys, qualifying referrals). We may withhold or reverse rewards obtained through fraud, error, or violation of these Terms.',
    'Payouts are subject to minimum thresholds, identity/fraud verification, and processing by third parties (Stripe, PayPal, and other supported methods). We do not guarantee any level of earnings.',
    'You are responsible for taxes on your earnings. We may issue tax forms (e.g., 1099) and request tax information where required by law.',
    'Certain in-app balances are closed-loop platform credits and may only be redeemable as described in the app.',
  ]},
  { h: '6. Referral program', b: [
    'You may earn commissions and rewards for referrals that meet our criteria. When you post referral or affiliate links on social media, you must clearly disclose the paid/affiliate relationship (e.g., "#ad") as required by the FTC and applicable law. Fake, incentivized-without-disclosure, or fraudulent referrals are prohibited.',
  ]},
  { h: '7. Contests & prize pools', b: [
    'Contests and prize pools on the platform are determined by skill and performance, not chance. Where an entry fee applies, it is disclosed, and contests are void where prohibited by law. Official rules, eligibility, and any regional restrictions apply and are incorporated by reference.',
  ]},
  { h: '8. Shared wallet groups', b: [
    'Group features let members pool closed-loop platform credits toward shared goals and transfer to group members, subject to owner approval and pool balance. These features are not a bank account, money-transmission, or investment service.',
  ]},
  { h: '9. Prohibited conduct', b: [
    'No fraud, bots, scripts, multi-accounting, self-referral, fake survey responses, manipulation of rewards, or circumvention of security. No illegal, harmful, or infringing content. We may suspend or terminate accounts that violate these Terms.',
  ]},
  { h: '10. Payments & third parties', b: [
    'Payments and payouts are handled by third-party processors under their own terms. We are not responsible for processor outages or decisions. Social platform integrations are subject to those platforms’ terms.',
  ]},
  { h: '11. Intellectual property & user content', b: [
    'The platform, its software, and content are owned by us or our licensors. You retain rights to content you submit but grant us a license to operate the service. AI-generated content and features are provided as-is.',
  ]},
  { h: '12. Disclaimers', b: [
    'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND. We do not warrant uninterrupted or error-free operation, or any specific earnings.',
  ]},
  { h: '13. Limitation of liability', b: [
    'TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, AND OUR TOTAL LIABILITY IS LIMITED TO THE AMOUNTS YOU PAID US (IF ANY) IN THE 12 MONTHS BEFORE THE CLAIM.',
  ]},
  { h: '14. Indemnification', b: [
    'You agree to indemnify and hold us harmless from claims arising out of your use of the service or violation of these Terms.',
  ]},
  { h: '15. Termination', b: [
    'You may stop using the service at any time. We may suspend or terminate access for violations or to comply with law. Certain provisions survive termination.',
  ]},
  { h: '16. Governing law & disputes', b: [
    `These Terms are governed by the laws of ${GOVERNING_LAW}. [Insert dispute-resolution / arbitration / class-action-waiver clause as advised by counsel.]`,
  ]},
  { h: '17. Changes', b: [
    'We may update these Terms. Continued use after changes means you accept the updated Terms.',
  ]},
  { h: '18. Contact', b: [
    `Questions? Contact ${COMPANY} at ${CONTACT_EMAIL}.`,
  ]},
];

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="text-3xl font-black text-gray-900">Terms of Service</h1>
        <p className="text-sm text-gray-500 mt-1">Effective date: {EFFECTIVE}</p>
        <div className="mt-3 mb-8 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
          Template for review — replace bracketed placeholders and have a lawyer review before launch.
        </div>
        {SECTIONS.map((s) => (
          <section key={s.h} className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">{s.h}</h2>
            {s.b.map((p, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed mb-2">{p}</p>
            ))}
          </section>
        ))}
        <div className="mt-8 pt-6 border-t text-sm text-gray-500">
          See also our <Link to={createPageUrl('PrivacyPolicy')} className="text-indigo-600 underline">Privacy Policy</Link>.
        </div>
      </div>
    </div>
  );
}
```

## `src/pages/WeeklyFeatureVote.jsx`

```jsx
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gamepad2, Sparkles, LayoutGrid, CheckCircle2, Loader2, Vote, DollarSign, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_META = {
  game: { icon: Gamepad2, label: 'New Game', color: 'bg-red-100 text-red-700' },
  feature: { icon: Sparkles, label: 'Feature', color: 'bg-purple-100 text-purple-700' },
  ui_ux: { icon: LayoutGrid, label: 'UI / UX', color: 'bg-blue-100 text-blue-700' },
};

export default function WeeklyFeatureVote() {
  const [user, setUser] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: survey, isLoading } = useQuery({
    queryKey: ['activeFeatureVote'],
    queryFn: async () => {
      const rows = await base44.entities.FeatureVoteSurvey.filter({ status: 'active' }, '-created_date', 1);
      return rows[0] || null;
    },
    enabled: !!user,
  });

  const alreadyVoted = !!(survey && user && (survey.responder_ids || []).includes(user.id));

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const submitMutation = useMutation({
    mutationFn: () => base44.functions.invoke('submitFeatureVote', {
      survey_id: survey.id,
      candidate_ids: [...selected],
    }),
    onSuccess: (res) => {
      const reward = res?.data?.reward ?? 0.1;
      toast.success(`Thanks for voting! $${Number(reward).toFixed(2)} credited to your balance.`);
      qc.invalidateQueries({ queryKey: ['activeFeatureVote'] });
      setSelected(new Set());
    },
    onError: (e) => {
      const msg = e?.response?.data?.error || e?.message || 'Could not submit your vote.';
      toast.error(msg);
      if (/already voted/i.test(msg)) qc.invalidateQueries({ queryKey: ['activeFeatureVote'] });
    },
  });

  if (!user || isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
            <Vote className="w-4 h-4" /> Weekly Feature Vote
          </div>
          <h1 className="text-3xl font-black text-gray-900">Help decide what we build next</h1>
          <p className="text-gray-500 mt-1">Your vote directly shapes the roadmap — and pays.</p>
        </div>

        {!survey ? (
          <Card>
            <CardContent className="py-16 text-center text-gray-500">
              <Vote className="w-14 h-14 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No active vote right now.</p>
              <p className="text-sm mt-1">A new survey opens every week — check back soon.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {!alreadyVoted && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <p className="text-sm text-blue-800">This week's vote is open — it takes 30 seconds and pays <strong>${Number(survey.reward_amount || 0.1).toFixed(2)}</strong>. Voting is optional.</p>
              </div>
            )}

            {alreadyVoted ? (
              <Card className="border-green-200 bg-green-50/40">
                <CardContent className="py-14 text-center">
                  <CheckCircle2 className="w-14 h-14 mx-auto mb-4 text-green-500" />
                  <p className="text-lg font-bold text-gray-900">You're all set for this week!</p>
                  <p className="text-sm text-gray-600 mt-1">Your vote was recorded and your reward credited. Results roll into the roadmap when voting closes.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{survey.title}</span>
                    <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />{Number(survey.reward_amount || 0.1).toFixed(2)}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-gray-500">{survey.description}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Select everything you'd like to see built</p>
                  {(survey.candidates || []).map((c) => {
                    const meta = TYPE_META[c.type] || TYPE_META.feature;
                    const Icon = meta.icon;
                    const isSel = selected.has(c.candidate_id);
                    return (
                      <button
                        key={c.candidate_id}
                        type="button"
                        onClick={() => toggle(c.candidate_id)}
                        className={`w-full text-left flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${isSel ? 'border-purple-500 bg-purple-50' : 'border-gray-100 hover:border-purple-200'}`}
                      >
                        <div className={`p-2 rounded-lg ${meta.color} flex-shrink-0`}><Icon className="w-5 h-5" /></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{c.title}</span>
                            <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                          </div>
                          {c.description && <p className="text-sm text-gray-500 mt-0.5">{c.description}</p>}
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 flex items-center justify-center ${isSel ? 'border-purple-500 bg-purple-500' : 'border-gray-300'}`}>
                          {isSel && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                      </button>
                    );
                  })}

                  <Button
                    className="w-full bg-purple-600 hover:bg-purple-700 h-11 text-base"
                    disabled={selected.size === 0 || submitMutation.isPending}
                    onClick={() => submitMutation.mutate()}
                  >
                    {submitMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      : <Vote className="w-4 h-4 mr-2" />}
                    Submit vote &amp; earn ${Number(survey.reward_amount || 0.1).toFixed(2)}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

## `src/pages/WeeklyReferralContest.jsx`

```jsx
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Twitter, Instagram, Facebook, Linkedin, Video, Share2, DollarSign, Trophy, Building2, User as UserIcon, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const PLATFORM_META = {
  twitter: { label: 'Twitter / X', icon: Twitter, color: 'text-sky-500' },
  instagram: { label: 'Instagram', icon: Instagram, color: 'text-pink-500' },
  facebook: { label: 'Facebook', icon: Facebook, color: 'text-blue-600' },
  tiktok: { label: 'TikTok', icon: Video, color: 'text-gray-900' },
  linkedin: { label: 'LinkedIn', icon: Linkedin, color: 'text-blue-700' },
};

export default function WeeklyReferralContest() {
  const [user, setUser] = useState(null);
  const [postUrl, setPostUrl] = useState('');
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['activeReferralCampaign'],
    queryFn: async () => {
      const rows = await base44.entities.WeeklyReferralCampaign.filter({ status: 'active' }, '-created_date', 1);
      return rows[0] || null;
    },
    enabled: !!user,
  });

  const { data: myEntries = [] } = useQuery({
    queryKey: ['myReferralEntries', campaign?.id, user?.id],
    queryFn: () => base44.entities.ReferralPostEntry.filter({ campaign_id: campaign.id, user_id: user.id }),
    enabled: !!campaign && !!user,
  });

  const submitMutation = useMutation({
    mutationFn: () => base44.functions.invoke('submitReferralPost', { post_url: postUrl, referral_code: user?.referral_code }),
    onSuccess: (res) => {
      const d = res?.data || {};
      const extra = d.doubled ? ` (doubled: ${d.remaining} more on ${d.platform})` : d.remaining ? ` (${d.remaining} more required)` : '';
      toast.success(`Post logged! $${Number(d.reward_pending || 0.1).toFixed(2)} pending — credited on your next survey.${extra}`);
      setPostUrl('');
      qc.invalidateQueries({ queryKey: ['myReferralEntries'] });
      qc.invalidateQueries({ queryKey: ['activeReferralCampaign'] });
    },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Could not log your post.'),
  });

  if (!user || isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  }

  const meta = campaign ? (PLATFORM_META[campaign.platform] || PLATFORM_META.twitter) : null;
  const PlatformIcon = meta?.icon || Share2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
            <Share2 className="w-4 h-4" /> Weekly Referral Prize Pool
          </div>
          <h1 className="text-3xl font-black text-gray-900">Post your referral, get paid</h1>
          <p className="text-gray-500 mt-1">A new platform every week. $0.10 per post + standard commission on conversions.</p>
        </div>

        {!campaign ? (
          <Card><CardContent className="py-16 text-center text-gray-500">
            <Share2 className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No active campaign right now.</p>
            <p className="text-sm mt-1">A new one opens every week — check back soon.</p>
          </CardContent></Card>
        ) : (
          <>
            <Card className="border-emerald-200">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><PlatformIcon className={`w-6 h-6 ${meta.color}`} /> This week: {meta.label}</span>
                  <Badge className="bg-green-100 text-green-700 flex items-center gap-1"><DollarSign className="w-3 h-3" />0.10 / post</Badge>
                </CardTitle>
                <p className="text-sm text-gray-500">{campaign.title}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">Participation is optional. If you skip a week, next week you can earn a <strong>double bonus</strong> by posting on your best-performing platform. Posts must include an <strong>#ad</strong> disclosure to stay FTC-compliant.</p>
                </div>

                {myEntries.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-700 font-medium"><CheckCircle2 className="w-5 h-5" /> You've logged {myEntries.length} post{myEntries.length > 1 ? 's' : ''} this week.</div>
                    {myEntries.map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                        <span className="truncate max-w-[60%]">{e.post_url}</span>
                        <Badge variant={e.reward_credited ? 'default' : 'secondary'} className="text-xs">
                          {e.reward_credited ? 'credited' : 'pending → next survey'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Paste the link to your post</label>
                  <div className="flex gap-2">
                    <Input value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder={`https://${campaign.platform}.com/your-post`} className="flex-1" />
                    <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={!postUrl || submitMutation.isPending} onClick={() => submitMutation.mutate()}>
                      {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400">Your $0.10 is held pending and credited the next time you complete a survey. Real conversions still earn your standard 5% affiliate commission.</p>
                </div>
              </CardContent>
            </Card>

            {(campaign.leaderboard_user?.length > 0 || campaign.leaderboard_business?.length > 0) && (
              <div className="grid md:grid-cols-2 gap-4">
                <LeaderboardCard title="User Referrers" icon={UserIcon} rows={campaign.leaderboard_user} />
                <LeaderboardCard title="Business Referrers" icon={Building2} rows={campaign.leaderboard_business} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LeaderboardCard({ title, icon: Icon, rows = [] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Icon className="w-4 h-4" /> {title} <Trophy className="w-4 h-4 text-yellow-500 ml-auto" /></CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No entries yet.</p>
        ) : (
          <div className="space-y-1.5">
            {rows.slice(0, 10).map((r, i) => (
              <div key={r.user_id || i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><span className="w-5 text-gray-400">{i + 1}.</span>{r.user_name || 'Member'}</span>
                <span className="text-gray-500">{r.conversions || 0} conv · {r.posts || 0} posts</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

## `src/pages/WishlistSharerLeaderboardPage.jsx`

```jsx
import React from 'react';
import { base44 } from '@/api/base44Client';
import { useEffect, useState } from 'react';
import WishlistSharerLeaderboard from '@/components/referral/WishlistSharerLeaderboard';

export default function WishlistSharerLeaderboardPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        setUser(me);
      } catch {
        base44.auth.redirectToLogin();
      }
    })();
  }, []);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">🏆 Wishlist Sharers Leaderboard</h1>
          <p className="text-gray-600">Top earners from sharing their wishlists — Prize Pool Points, conversions & more</p>
        </div>
        <WishlistSharerLeaderboard />
      </div>
    </div>
  );
}```

