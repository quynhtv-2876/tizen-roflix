// Client configuration
// IMPORTANT: Do NOT hardcode real API keys here for public repos.
// For local development, set the values below.
// For production: change serverUrl to your deployed server URL.

const config = {
    // Server URL — change to your local IP when testing on TV
    // Examples:
    //   Local dev (simulator):  'http://localhost:3000'
    //   Local dev (real TV):    'http://192.168.1.x:3000'
    //   Production (Render/Railway):  'https://your-app.onrender.com'
    serverUrl: 'http://localhost:3000',

    // API Key — must match API_KEY in server .env
    // This is Base64 encoded (NOT secure encryption, just obfuscation)
    // Change this to match your own API_KEY value
    // To encode: btoa('YOUR_API_KEY') in browser console
    encodedApiKey: 'CHANGE_ME_BASE64_ENCODED_API_KEY',
};
