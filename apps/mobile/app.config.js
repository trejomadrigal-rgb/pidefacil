// app.config.js overrides app.json for fields that need dynamic resolution.
// On EAS Build: GOOGLE_SERVICES_JSON is a secret file env var (path injected by EAS).
// Locally: falls back to ./google-services.json (gitignored, must exist for dev).
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
