// Polyfills necessaris per a jsdom 27 amb Node 18
if (!Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")) {
  Object.defineProperty(ArrayBuffer.prototype, "resizable", {
    configurable: true,
    enumerable: false,
    get() {
      return false;
    },
  });
}

if (typeof SharedArrayBuffer !== "undefined") {
  if (
    !Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "growable")
  ) {
    Object.defineProperty(SharedArrayBuffer.prototype, "growable", {
      configurable: true,
      enumerable: false,
      get() {
        return false;
      },
    });
  }
}
