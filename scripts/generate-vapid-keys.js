const webpush = require("web-push");
const keys = webpush.generateVAPIDKeys();
console.log("\nAdd these to your .env / Vercel environment:\n");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`\nVAPID_SUBJECT=mailto:your-email@example.com`);
console.log("\nPublic key goes to the browser, private key stays on the server.\n");
