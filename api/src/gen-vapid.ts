// Gera um par de chaves VAPID para colar no .env: `npm run vapid -w api` (ou `node dist/gen-vapid.js`).
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
