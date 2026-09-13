import { __handler } from "../../sdk/runtime.ts";
import {
  perfMonitoringEnabled, perfPrefetchEnabled, perfPrefetchLevel, perfQueryStaleMinutes, perfSampleRate,
  prefetchStrategyForLevel, perfPreloadOnWaitEnabled,
} from "../../sdk/perf-optimizer.ts";

// perfConfig — the tiny PUBLIC config the client reads at startup to know how to behave for speed: whether to
// send telemetry (+ at what sample rate), and how aggressively to prefetch the next page's code. The prefetch
// level here is the value the AI load-time optimizer tunes (PERF_PREFETCH_LEVEL) — so when the optimizer dials
// it up/down to keep navigation under the ~80ms budget, the client picks the new strategy up on next load with
// no redeploy. Anonymous + read-only.
export default __handler(async () => {
  try {
    const level = perfPrefetchLevel();
    return Response.json({
      monitoring_enabled: perfMonitoringEnabled(),
      sample_rate: perfSampleRate(),
      prefetch_enabled: perfPrefetchEnabled(),
      prefetch_level: level,
      prefetch_strategy: perfPrefetchEnabled() ? prefetchStrategyForLevel(level) : "off",
      query_stale_minutes: perfQueryStaleMinutes(),
      preload_on_wait: perfPreloadOnWaitEnabled(),
    });
  } catch {
    return Response.json({ monitoring_enabled: true, sample_rate: 1, prefetch_enabled: true, prefetch_strategy: "visible", query_stale_minutes: 15, preload_on_wait: true });
  }
});
