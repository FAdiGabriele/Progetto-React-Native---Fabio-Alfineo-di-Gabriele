// Fixes the time zone of every test run, so formatted dates do not depend on the machine, and
// starts every run with fixture mode off, whatever the shell sets.
module.exports = function globalSetup() {
  process.env.TZ = 'Europe/Rome';
  delete process.env.EXPO_PUBLIC_NEWS_USE_FIXTURES;
};
