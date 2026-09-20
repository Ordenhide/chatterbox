/**
 * Extracts the ICE server list from a Cloudflare Realtime
 * `generate-ice-servers` response (see index.js's getTurnCredentials).
 *
 * Cloudflare's own response already includes a STUN entry alongside the
 * authenticated TURN one, so this only has to validate the shape rather than
 * assemble anything — a malformed or empty response is reported as a real
 * failure rather than silently handing the client nothing to connect with.
 */
function extractIceServers(response) {
  if (!Array.isArray(response?.iceServers) || response.iceServers.length === 0) {
    throw new Error('Cloudflare response had no iceServers');
  }
  return response.iceServers;
}

module.exports = {extractIceServers};
