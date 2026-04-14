'use strict';

var react = require('react');
var core = require('@wavr/core');
var jsxRuntime = require('react/jsx-runtime');

// src/WavrGradient.tsx
function WavrGradient({
  config,
  className,
  style,
  interactive = true,
  paused = false,
  scrollLinked = false,
  scrollDuration = 10,
  speed = 1,
  onError
}) {
  const containerRef = react.useRef(null);
  const handleRef = react.useRef(null);
  const configRef = react.useRef(config);
  configRef.current = config;
  react.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const canvas = document.createElement("canvas");
    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);
    const handle = core.createGradient(canvas, configRef.current, { onError });
    handleRef.current = handle;
    const ro = new ResizeObserver(([entry]) => {
      handle.resize(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(container);
    return () => {
      ro.disconnect();
      handle.destroy();
      handleRef.current = null;
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, []);
  react.useEffect(() => {
    var _a;
    (_a = handleRef.current) == null ? void 0 : _a.update(config);
  }, [config]);
  react.useEffect(() => {
    var _a, _b;
    if (paused) {
      (_a = handleRef.current) == null ? void 0 : _a.pause();
    } else if (!scrollLinked) {
      (_b = handleRef.current) == null ? void 0 : _b.play();
    }
  }, [paused, scrollLinked]);
  react.useEffect(() => {
    var _a;
    (_a = handleRef.current) == null ? void 0 : _a.setSpeed(speed);
  }, [speed]);
  react.useEffect(() => {
    if (!interactive) return;
    const el = containerRef.current;
    if (!el) return;
    const handlePointer = (x, y) => {
      var _a;
      const rect = el.getBoundingClientRect();
      (_a = handleRef.current) == null ? void 0 : _a.setMouse(
        (x - rect.left) / rect.width,
        1 - (y - rect.top) / rect.height
      );
    };
    const onMouse = (e) => handlePointer(e.clientX, e.clientY);
    const onTouch = (e) => {
      const t = e.touches[0];
      if (t) handlePointer(t.clientX, t.clientY);
    };
    el.addEventListener("mousemove", onMouse);
    el.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      el.removeEventListener("mousemove", onMouse);
      el.removeEventListener("touchmove", onTouch);
    };
  }, [interactive]);
  react.useEffect(() => {
    var _a;
    if (!scrollLinked) return;
    (_a = handleRef.current) == null ? void 0 : _a.pause();
    const onScroll = () => {
      var _a2;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
      (_a2 = handleRef.current) == null ? void 0 : _a2.setTime(progress * scrollDuration);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollLinked, scrollDuration]);
  return /* @__PURE__ */ jsxRuntime.jsx("div", { ref: containerRef, className, style });
}

exports.WavrGradient = WavrGradient;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map