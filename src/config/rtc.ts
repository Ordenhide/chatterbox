/**
 * ICE servers for WebRTC. Public STUN servers require no credentials.
 * NOTE: If adding TURN servers with username/credential, use a TURN credentials
 * API (e.g. Xirsys, Twilio, or your own) to fetch short-lived credentials
 * instead of hardcoding them here.
 */
export const ICE_SERVERS = [
  {urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']},
  // Optional TURN server (recommended for reliable audio/video over NATs)
  // {
  //   urls: [
  //     'turn:turn.example.com:3478?transport=udp',
  //     'turn:turn.example.com:3478?transport=tcp',
  //     'turns:turn.example.com:5349?transport=tcp',
  //   ],
  //   username: 'TURN_USERNAME',
  //   credential: 'TURN_PASSWORD',
  // },
];

