// this file is injected into the browser on page load/navigation
(function() {
  const origRAF = window.requestAnimationFrame.bind(window);

  let nextRAFId = 0;

  // need to keep callbacks around so we can cancel them. That includes
  // 2 callbacks added to the same frame where the first callback cancels the second
  const allCallbacks = new Map();

  // callbacks added since last fake rAF
  let pendingCallbacks = new Map();

  // 2 doesn't work. 3 *seemed* iffy.
  const framesPerTick = 4;
  let frameCount = 0;

  function rafProcess(time) {
    ++frameCount;
    if (frameCount === framesPerTick) {
      frameCount = 0;
      const callbacks = pendingCallbacks;
      pendingCallbacks = new Map();
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
    origRAF(rafProcess);
  }

  // maybe should only do this on first rAF
  origRAF(rafProcess);

  window.requestAnimationFrame = function(callback) {
    const rafId = nextRAFId++;
    const callbackInfo = {callback, cancelled: false};
    allCallbacks.set(rafId, callbackInfo);
    pendingCallbacks.set(rafId, callbackInfo);
    return rafId;
  };

  window.cancelRequestAnimationFrame = function(rafId) {
    const cb = allCallbacks.get(rafId);
    if (cb) {
      cb.cancelled = true;
    }
  };
}());
