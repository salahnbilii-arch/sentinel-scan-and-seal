const m = /(\d+)-(\d+)/.exec(input);
const handlers = { start, stop };
if (m && handlers[cmd]) await handlers[cmd]();
