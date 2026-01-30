// Jest setup provided by Grafana scaffolding
import './.config/jest-setup';

// React 19 requires additional globals for Jest environment
// Polyfill MessageChannel for scheduling
if (typeof MessageChannel === 'undefined') {
  global.MessageChannel = class MessageChannel {
    constructor() {
      this.port1 = {
        postMessage: (message) => {
          if (this.port2.onmessage) {
            setTimeout(() => this.port2.onmessage({ data: message }), 0);
          }
        },
        onmessage: null,
      };
      this.port2 = {
        postMessage: (message) => {
          if (this.port1.onmessage) {
            setTimeout(() => this.port1.onmessage({ data: message }), 0);
          }
        },
        onmessage: null,
      };
    }
  };
}

// Polyfill TextEncoder/TextDecoder
if (typeof TextEncoder === 'undefined') {
  const util = require('util');
  global.TextEncoder = util.TextEncoder;
  global.TextDecoder = util.TextDecoder;
}
