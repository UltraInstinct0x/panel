/*!
 * panel edge features v1 — aggregate-only feature extraction.
 * no raw replay export, no PII, no long telemetry arrays.
 * output: pure aggregates suitable for edge model inference.
 */
(function (global) {
  'use strict';

  /**
   * Extract aggregated features from fingerprint snapshot.
   * @param {Object} fp - fingerprint from collector.snapshot()
   * @returns {Object} aggregated features suitable for model inference
   */
  function extractFeatures(fp) {
    if (!fp || typeof fp !== 'object') return buildEmptyFeatures();

    var pointerDynamics = extractPointerDynamics(fp.mouse_samples || []);
    var timingEntropy = extractTimingEntropy(fp);
    var focusVisibility = extractFocusVisibility(fp);
    var automation = detectAutomationIndicators();
    var runtimeHealth = checkRuntimeHealth(fp);

    return {
      pointer_dynamics: pointerDynamics,
      timing_entropy: timingEntropy,
      focus_visibility: focusVisibility,
      automation_indicators: automation,
      runtime_health: runtimeHealth,
      feature_version: 'v1',
    };
  }

  /**
   * Pointer dynamics: speed, variance, jerk aggregates.
   */
  function extractPointerDynamics(samples) {
    if (!Array.isArray(samples) || samples.length < 2) {
      return { count: 0, mean_speed: 0, variance_speed: 0, mean_jerk: 0 };
    }

    var speeds = [];
    var jerks = [];
    var prevSpeed = 0;

    for (var i = 1; i < samples.length; i++) {
      var prev = samples[i - 1];
      var curr = samples[i];
      var dt = (curr.t - prev.t) / 1000; // seconds
      if (dt <= 0 || dt > 5) continue; // skip outliers

      var dx = curr.x - prev.x;
      var dy = curr.y - prev.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var speed = dist / dt; // px/s
      speeds.push(speed);

      // jerk: rate of change of acceleration (approximated as delta of speed)
      var jerk = Math.abs(speed - prevSpeed) / dt;
      jerks.push(jerk);
      prevSpeed = speed;
    }

    return {
      count: samples.length,
      mean_speed: mean(speeds),
      variance_speed: variance(speeds),
      mean_jerk: mean(jerks),
    };
  }

  /**
   * Timing entropy: click/keydown interval summaries.
   */
  function extractTimingEntropy(fp) {
    var dwellMs = fp.dwell_ms || 0;
    var keyEvents = fp.key_events || 0;
    var mouseCount = (fp.mouse_samples || []).length;

    // approximate entropy: coefficient of variation of mouse sample intervals
    var mouseSamples = fp.mouse_samples || [];
    var intervals = [];
    for (var i = 1; i < mouseSamples.length; i++) {
      intervals.push(mouseSamples[i].t - mouseSamples[i - 1].t);
    }

    var meanInterval = mean(intervals);
    var stdInterval = Math.sqrt(variance(intervals));
    var coefVariation = meanInterval > 0 ? stdInterval / meanInterval : 0;

    return {
      dwell_ms: dwellMs,
      key_events: keyEvents,
      mouse_count: mouseCount,
      interval_coef_variation: coefVariation,
    };
  }

  /**
   * Focus/visibility behavior counts.
   */
  function extractFocusVisibility(fp) {
    return {
      focus_events: fp.focus_events || 0,
      blur_events: fp.blur_events || 0,
      visibility_changes: fp.visibility_changes || 0,
      pointer_type: fp.pointer_type || 'unknown',
    };
  }

  /**
   * Automation indicators: webdriver/headless/global artifacts.
   */
  function detectAutomationIndicators() {
    var flags = {
      webdriver: false,
      headless: false,
      phantom: false,
      selenium: false,
      puppeteer: false,
      playwright: false,
      cdp: false,
    };

    try {
      // WebDriver flag
      if (navigator.webdriver === true) flags.webdriver = true;

      // Headless chrome (conservative signal only)
      if ((/HeadlessChrome/i).test(navigator.userAgent)) flags.headless = true;

      // PhantomJS
      if (window.callPhantom || window._phantom) flags.phantom = true;

      // Selenium globals
      if (window.document && (window.document.__webdriver_evaluate || window.document.__selenium_evaluate || window.document.__webdriver_script_fn || window.document.__driver_evaluate || window.document.__webdriver_unwrapped || window.document.__selenium_unwrapped)) {
        flags.selenium = true;
      }

      // Puppeteer globals (avoid broad chrome.runtime heuristics)
      if (window.__puppeteer_evaluation_script__ || window.__nightmare || window.__webdriver_script_fn) {
        flags.puppeteer = true;
      }

      // Playwright globals
      if (window.__playwright || window.__pw_manual) flags.playwright = true;

      // CDP-oriented globals/signals (conservative)
      if (window.__cdp || window.__chromeDevtoolsHook) {
        flags.cdp = true;
      }
    } catch (_) {
      // swallow errors — fingerprint environment may be restricted
    }

    return flags;
  }

  /**
   * Runtime health: missing feature flags, capability bits.
   */
  function checkRuntimeHealth(fp) {
    return {
      has_mouse_samples: Array.isArray(fp.mouse_samples) && fp.mouse_samples.length > 0,
      has_scroll_samples: Array.isArray(fp.scroll_samples) && fp.scroll_samples.length > 0,
      has_pointer_type: Boolean(fp.pointer_type && fp.pointer_type !== 'unknown'),
      dwell_ms_valid: typeof fp.dwell_ms === 'number' && fp.dwell_ms > 0,
    };
  }

  /**
   * Empty features fallback (when fingerprint is missing or invalid).
   */
  function buildEmptyFeatures() {
    return {
      pointer_dynamics: { count: 0, mean_speed: 0, variance_speed: 0, mean_jerk: 0 },
      timing_entropy: { dwell_ms: 0, key_events: 0, mouse_count: 0, interval_coef_variation: 0 },
      focus_visibility: { focus_events: 0, blur_events: 0, visibility_changes: 0, pointer_type: 'unknown' },
      automation_indicators: { webdriver: false, headless: false, phantom: false, selenium: false, puppeteer: false, playwright: false, cdp: false },
      runtime_health: { has_mouse_samples: false, has_scroll_samples: false, has_pointer_type: false, dwell_ms_valid: false },
      feature_version: 'v1',
    };
  }

  // ---------- utility ----------
  function mean(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    var sum = 0;
    for (var i = 0; i < arr.length; i++) sum += arr[i];
    return sum / arr.length;
  }

  function variance(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    var m = mean(arr);
    var sumSq = 0;
    for (var i = 0; i < arr.length; i++) {
      var diff = arr[i] - m;
      sumSq += diff * diff;
    }
    return sumSq / arr.length;
  }

  // ---------- export ----------
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractFeatures: extractFeatures };
  } else {
    global.PanelEdgeFeatures = { extractFeatures: extractFeatures };
  }
})(typeof window !== 'undefined' ? window : global);
