// this file is injected into the browser on page load/navigation
(function() {
  let nextRAFId = 1;
  let timeoutId;

  // need to keep callbacks around so we can cancel them. That includes
  // 2 callbacks added to the same frame where the first callback cancels the second
  const allCallbacks = new Map();

  // callbacks added since last fake rAF
  let pendingCallbacks = new Map();

  // 2 doesn't work. 3 *seemed* iffy.
  const framesPerTick = 4;
  let frameCount = 0;

  function processCallbacks(callbacks, time) {
    callbacks.forEach(function(callbackInfo, rafId) {
      allCallbacks.delete(rafId);

      // call in timeout because we don't want to deal with exceptions in callback
      setTimeout(() => {
        if (!callbackInfo.cancelled) {
          callbackInfo.callback(time);
        }
      }, 0);
    });
  }

  function rafProcess() {
    timeoutId = undefined;
    ++frameCount;
    if (frameCount === framesPerTick) {
      frameCount = 0;
      const callbacks = pendingCallbacks;
      pendingCallbacks = new Map();
      processCallbacks(callbacks, performance.now());
    }
  }

  function queueRAF() {
    if (!timeoutId) {
      setTimeout(rafProcess, 200);
    }
  }

  window.requestAnimationFrame = function(callback) {
    const rafId = nextRAFId++;
    const callbackInfo = {callback, cancelled: false};
    allCallbacks.set(rafId, callbackInfo);
    pendingCallbacks.set(rafId, callbackInfo);
    queueRAF();
    return rafId;
  };

  window.cancelAnimationFrame = function(rafId) {
    const cb = allCallbacks.get(rafId);
    if (cb) {
      cb.cancelled = true;
    }
  };
}());
