/*!
 * panel edge runtime v1 — capability detection for model inference.
 * checks: Worker support, WASM support, WebGPU support (future).
 * returns capability flags used to decide inference runtime.
 */
(function (global) {
  'use strict';

  /**
   * Detect runtime capabilities.
   * @returns {Object} capability flags
   */
  function detectCapabilities() {
    return {
      worker: checkWorkerSupport(),
      wasm: checkWasmSupport(),
      webgpu: checkWebGpuSupport(),
    };
  }

  /**
   * Check if Worker API is available.
   */
  function checkWorkerSupport() {
    try {
      return typeof Worker !== 'undefined';
    } catch (_) {
      return false;
    }
  }

  /**
   * Check if WebAssembly is available.
   */
  function checkWasmSupport() {
    try {
      return typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiate === 'function';
    } catch (_) {
      return false;
    }
  }

  /**
   * Check if WebGPU is available (future-proofing).
   */
  function checkWebGpuSupport() {
    try {
      return typeof navigator !== 'undefined' && typeof navigator.gpu !== 'undefined';
    } catch (_) {
      return false;
    }
  }

  /**
   * Determine best runtime for inference based on capabilities.
   * @param {Object} caps - capabilities from detectCapabilities()
   * @returns {'wasm'|'webgpu'|'rules_only'}
   */
  function selectRuntime(caps) {
    if (!caps) caps = detectCapabilities();

    // Phase 2: scaffolding only, no real model artifacts yet.
    // Future: prefer WebGPU > WASM > rules_only
    // For now: always return rules_only (fallback mode)
    
    // Stub logic for future phase:
    // if (caps.webgpu) return 'webgpu';
    // if (caps.worker && caps.wasm) return 'wasm';
    
    return 'rules_only';
  }

  // ---------- export ----------
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      detectCapabilities: detectCapabilities,
      selectRuntime: selectRuntime,
      checkWorkerSupport: checkWorkerSupport,
      checkWasmSupport: checkWasmSupport,
      checkWebGpuSupport: checkWebGpuSupport,
    };
  } else {
    global.PanelEdgeRuntime = {
      detectCapabilities: detectCapabilities,
      selectRuntime: selectRuntime,
      checkWorkerSupport: checkWorkerSupport,
      checkWasmSupport: checkWasmSupport,
      checkWebGpuSupport: checkWebGpuSupport,
    };
  }
})(typeof window !== 'undefined' ? window : global);
