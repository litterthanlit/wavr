// Stands in for @wavr/preview, which WavrGradient imports lazily for its editor
// overlay and which needs a build to resolve. The pointer tests never mount it.
export const mountWavrEditor = () => ({ update() {}, destroy() {} });
