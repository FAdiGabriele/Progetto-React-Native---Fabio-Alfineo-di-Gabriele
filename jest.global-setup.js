// Fixes the time zone of every test run, so formatted dates do not depend on the machine.
module.exports = function globalSetup() {
  process.env.TZ = 'Europe/Rome';
};
