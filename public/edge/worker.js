/*!
 * panel edge worker v1 — worker boot + inference timeout guard.
 * 100ms hard timeout on inference → fallback to rules_only.
 * phase 2: scaffolding only, no real model artifacts yet.
 */
(function (global) {
  'use strict';

  var INFERENCE_TIMEOUT_MS = 100; // conservative for p95 <20ms target

  /**
   * Invoke edge model inference with timeout guard.
   * @param {Object} features - aggregated features from extractFeatures()
   * @param {Object} options - { timeoutMs, onSuccess, onTimeout, onError }
   * @returns {Promise<Object>} - resolves with EdgeModelClientPayload or fallback
   */
  function invokeWithTimeout(features, options) {
    options = options || {};
    var timeoutMs = options.timeoutMs || INFERENCE_TIMEOUT_MS;

    return new Promise(function (resolve) {
      var completed = false;
      var timeoutId = null;

      // Hard timeout: if inference doesn't complete in time, fallback
      timeoutId = setTimeout(function () {
        if (completed) return;
        completed = true;
        var fallback = buildFallbackPayload('inference_timeout');
        if (typeof options.onTimeout === 'function') {
          try { options.onTimeout(fallback); } catch (_) {}
        }
        resolve(fallback);
      }, timeoutMs);

      // Phase 2: no real model yet, immediately return rules_only
      // Future phase 3+: spawn worker, postMessage(features), await result
      try {
        var result = runPlaceholderInference(features);
        if (!completed) {
          completed = true;
          clearTimeout(timeoutId);
          if (typeof options.onSuccess === 'function') {
            try { options.onSuccess(result); } catch (_) {}
          }
          resolve(result);
        }
      } catch (err) {
        if (!completed) {
          completed = true;
          clearTimeout(timeoutId);
          var errorPayload = buildFallbackPayload('inference_error');
          if (typeof options.onError === 'function') {
            try { options.onError(err, errorPayload); } catch (_) {}
          }
          resolve(errorPayload);
        }
      }
    });
  }

  /**
   * Placeholder inference (phase 2 scaffolding).
   * Future: spawn worker, load WASM, run model.
   */
  function runPlaceholderInference(features) {
    // Phase 2: no model artifacts yet, always return rules_only
    return {
      local_score: null,
      local_class_probs: {},
      reason_codes: ['edge_model_scaffold', 'phase2_placeholder'],
      model_version: 'edge-risk-v1-scaffold',
      feature_version: features.feature_version || 'v1',
      runtime: 'rules_only',
      model_error: false,
    };
  }

  /**
   * Build fallback payload when inference fails or times out.
   */
  function buildFallbackPayload(reasonCode) {
    return {
      local_score: null,
      local_class_probs: {},
      reason_codes: ['edge_model_scaffold', reasonCode],
      model_version: 'edge-risk-v1-scaffold',
      feature_version: 'v1',
      runtime: 'rules_only',
      model_error: true,
    };
  }

  /**
   * Check if worker runtime is available.
   * Future: instantiate worker, check for WASM support inside worker.
   */
  function checkWorkerAvailable() {
    try {
      return typeof Worker !== 'undefined';
    } catch (_) {
      return false;
    }
  }

  // ---------- export ----------
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      invokeWithTimeout: invokeWithTimeout,
      runPlaceholderInference: runPlaceholderInference,
      buildFallbackPayload: buildFallbackPayload,
      checkWorkerAvailable: checkWorkerAvailable,
      INFERENCE_TIMEOUT_MS: INFERENCE_TIMEOUT_MS,
    };
  } else {
    global.PanelEdgeWorker = {
      invokeWithTimeout: invokeWithTimeout,
      runPlaceholderInference: runPlaceholderInference,
      buildFallbackPayload: buildFallbackPayload,
      checkWorkerAvailable: checkWorkerAvailable,
      INFERENCE_TIMEOUT_MS: INFERENCE_TIMEOUT_MS,
    };
  }
})(typeof window !== 'undefined' ? window : global);
