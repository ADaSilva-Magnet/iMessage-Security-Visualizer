// The walkthrough: one entry per step of the iMessage send/receive process, as described in the iMessage
// section of the Apple Platform Security guide.
import { COLORS } from './palette.js';
import { T, k01, lane, SENDER, MESSAGE, deliverState, unlockState, fetchState } from './sync.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
export const C = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, hex(v)]));
const win = (t, a, b) => k01(t, a - 0.25, a) * (1 - k01(t, b, b + 0.3));
const after = (s, v = 1) => (t) => (t > s ? v : 0);

export const GROUPS = [
  { id: 'intro', label: 'Start' },
  { id: 'setup', label: 'Setting up' },
  { id: 'send', label: 'Sending' },
  { id: 'receive', label: 'Receiving' },
  { id: 'end', label: 'Wrap-up' },
];

const LANES_SHOT = { target: [-3.0, 3.0, 4.1], dir: [0.15, 0.14, 1], dist: 16.5 };
const regCount = (t) => [T.register.alex, T.register.phone, T.register.pad, T.register.mac].filter((x) => t >= x - 0.1).length;

export const STEPS = [
  {
    id: 'overview', chip: 'Overview', group: 'intro', cap: 'Who does what',
    kicker: 'Apple Platform Security · iMessage', title: 'How iMessage sends and receives messages securely',
    lead: 'iMessage relies on the Apple Push Notification service (APNs) to deliver texts and attachments. Message content and attachments are end-to-end encrypted, so no one but the sender and receiver can access them — Apple can\'t decrypt the data.',
    points: [
      '<b>Alex\'s iPhone</b> (sender) encrypts the message for each receiving device.',
      '<b>Apple Identity Service (IDS)</b> is the directory of each device\'s public keys and APNs address.',
      '<b>APNs</b> delivers the encrypted messages; <b>iCloud</b> holds encrypted attachments.',
      '<b>Riley</b> (recipient) has three devices — iPhone, iPad and Mac — and each gets its own copy.',
      'We\'ll follow one message from start to finish.',
    ],
    shot: { target: [-0.5, 3.0, -4.0], dir: [0.06, 0.34, 1], dist: 33 }, sway: true, inset: 'hide',
    state: () => ({ idsRecords: 4 }),
    labels: [
      { at: 'alex', text: "Alex's iPhone", sub: 'sender', color: C.send, dx: -30, dy: -110 },
      { at: 'riley', text: "Riley's devices", sub: 'recipient · iPhone, iPad, Mac', color: C.phone, dx: 60, dy: -150 },
    ],
  },
  {
    id: 'keys', chip: 'Key pairs', group: 'setup', cap: 'Turning on iMessage',
    kicker: 'Setting up · Turning on iMessage', title: 'Each device makes its own keys',
    lead: 'When a user turns on iMessage on a device, the device generates encryption and signing pairs of keys for use with the service.',
    define: {
      text: '<b class="term">Asymmetric (public-key) cryptography</b> uses key pairs: a <b>public key</b> that can be shared and a <b>private key</b> that stays secret on the device.',
      pairs: [
        ['send', 'Encryption', 'keeps messages private: public key locks, private key unlocks.'],
        ['sign', 'Signing', 'proves who sent them: private key signs, public key checks.'],
      ],
    },
    points: [
      '<b>Why two pairs?</b> Every device both sends and receives. To message Riley, Alex\'s iPhone uses <b>Riley\'s public encryption key</b> and <b>its own private signing key</b>.',
    ],
    link: 'The message itself is encrypted with a one-time symmetric AES key; the key pairs lock that key and sign the result.',
    shot: { target: [-5.0, 3.0, 3.8], dir: [0.3, 0.12, 1], dist: 9.6 },
    state: () => ({ fog: 1,  idsRecords: 0 }), focus: ['alex'],
    labels: [
      { at: 'keys.encPub', text: 'Encryption key pair', sub: 'keeps messages private', color: C.send, dx: 170, dy: -50, when: [1.0, 99] },
      { at: 'keys.sigPub', text: 'Signing key pair', sub: 'proves who sent a message', color: C.sign, dx: 170, dy: 50, when: [1.3, 99] },
      { at: 'keys.encPriv', text: 'Private keys', sub: 'stay on this iPhone', color: '#e2e8f0', dx: -40, dy: -130, when: [1.6, 4.3] },
    ],
  },
  {
    id: 'register', chip: 'Register', group: 'setup', cap: 'The IDS directory',
    kicker: 'Setting up · Apple Identity Service', title: 'Public keys are registered with IDS',
    lead: 'The public keys are sent to Apple Identity Service (IDS), where they\'re associated with the user\'s phone number or email address, along with the device\'s APNs address.',
    points: [
      'Each additional device adds its own public keys, APNs address and phone numbers to the directory.',
      'Email addresses are verified with a <b>confirmation link</b>; phone numbers by the <b>carrier network and SIM</b>.',
      'All of the user\'s registered devices show an <b>alert</b> when a new device, phone number or email address is added.',
    ],
    link: 'IDS now knows every device that can receive iMessage for Riley\'s phone number and email address.',
    shot: { target: [-0.5, 2.6, -3.0], dir: [0.06, 0.46, 1], dist: 32 }, inset: 'hide',
    state: (t) => ({ idsRecords: regCount(t), idsSeek: 1, alert: t > T.register.alert ? 1 : 0 }), focus: ['ids'],
    labels: [
      { at: 'ids', text: 'Apple Identity Service', sub: (t) => `${regCount(t)} of 4 devices registered`, color: C.ids, dx: -20, dy: -70 },
      { at: 'reg.alex', text: "Alex's public keys", sub: '+ APNs address', color: C.send, dx: 120, dy: -50, when: [0, T.register.alex - 0.3] },
      { at: 'rMac', text: "Riley's Mac", sub: 'a new device', color: C.mac, dx: 60, dy: -110, when: [5.0, 99] },
      { at: 'rPhone', text: 'Alert on Riley\'s other devices', sub: 'new device added', color: '#fbbf24', dx: -190, dy: -70, when: [T.register.alert, 99] },
    ],
  },
  {
    id: 'lookup', chip: 'Look up', group: 'send', cap: 'Who is Riley?',
    kicker: 'Sending · Step 1', title: 'Look up the recipient in IDS',
    lead: 'Alex starts a new conversation by entering an address or name. The device contacts IDS to retrieve the public keys and APNs addresses for all of the devices associated with the addressee.',
    points: [
      'If the user enters a <b>name</b>, the device first uses the Contacts app to gather that person\'s phone numbers and email addresses.',
      'IDS returns the public <b>encryption and signing keys</b> and the <b>APNs address</b> of each of Riley\'s devices.',
    ],
    link: 'Three receiving devices means three separately encrypted copies of the message.',
    shot: { target: [-4.0, 4.5, -1.0], dir: [0.5, 0.25, 1], dist: 24 },
    state: (t) => ({ idsRecords: 4, idsSeek: 1, idsRiley: t > T.lookup.search[0] && t < T.lookup.back[1] + 1 ? 1 : 0 }), focus: ['ids'],
    labels: [
      { at: 'look.orb', text: 'Lookup request', sub: 'Riley\'s phone number / email', color: C.ids, dx: 130, dy: -50, when: [0.4, 2.1] },
      { at: 'idsCards', text: "Riley's 3 devices", sub: 'public keys + APNs addresses', color: C.ids, dx: 170, dy: -30, when: [2.0, 99] },
      { at: 'look.key0', text: 'For each device', sub: 'its public keys + APNs address', color: C.phone, dx: 120, dy: -60, when: [4.4, 99] },
    ],
  },
  {
    id: 'msgkey', chip: 'Message key', group: 'send', cap: 'Building the 128-bit key',
    kicker: 'Sending · Step 2', title: 'A new 128-bit key for each device',
    lead: 'The outgoing message is individually encrypted for each of the receiver\'s devices. For each one, the sending device builds a fresh key from two parts.',
    spec: { rows: [['88 bits', 'random value', 'rand'], ['40 bits', 'HMAC-SHA-256 value', 'phone'], ['128 bits', 'AES message key', 'send']] },
    points: [
      'The device generates a <b>random 88-bit value</b>.',
      'It uses that value as an <b>HMAC-SHA-256 key</b> to construct a <b>40-bit value</b> derived from the sender and receiver public keys and the plaintext.',
      '88 + 40 bits = a <b>128-bit key</b>. The receiver later uses the 40-bit value to verify the integrity of the decrypted text.',
    ],
    link: 'Next, this key encrypts the message text.',
    shot: LANES_SHOT,
    state: () => ({ fog: 1,  idsRecords: 4 }),
    flows: [0, 1, 2].flatMap((i) => [
      { key: `hb${i}`, from: 'mk.bubble', to: `mk.ring${i}`, color: '#93c5fd', speed: 0.8, count: 12, size: 0.085, lift: 0.35, alpha: (t) => win(lane(t, i), T.msgkey.hmac[0], T.msgkey.hmac[1]) },
      { key: `ha${i}`, from: 'mk.akey', to: `mk.ring${i}`, color: C.send, speed: 0.75, count: 10, size: 0.085, lift: 0.5, alpha: (t) => win(lane(t, i), T.msgkey.hmac[0], T.msgkey.hmac[1]) },
      { key: `hd${i}`, from: `mk.key${i}`, to: `mk.ring${i}`, color: [C.phone, C.pad, C.mac][i], speed: 0.8, count: 10, size: 0.085, lift: 0.3, alpha: (t) => win(lane(t, i), T.msgkey.hmac[0], T.msgkey.hmac[1]) },
    ]),
    labels: [
      { at: 'mk.bubble', text: 'Plaintext', sub: `“${MESSAGE}”`, color: '#93c5fd', dx: 150, dy: -40 },
      { at: 'mk.rand0', text: '88-bit random value', sub: 'new for every device', color: '#e2e8f0', dx: -60, dy: -120, when: [1.0, 99] },
      { at: 'mk.bar2', text: '128-bit key', sub: '88 random + 40 HMAC bits', color: C.mac, dx: -40, dy: 100, when: [T.msgkey.done + 0.8, 99] },
    ],
  },
  {
    id: 'encrypt', chip: 'Encrypt', group: 'send', cap: 'AES in Counter mode',
    kicker: 'Sending · Step 3', title: 'Encrypt the text with AES-CTR',
    lead: 'Each 128-bit key encrypts the message using AES in Counter (CTR) mode.',
    points: [
      'One encrypted copy per receiving device — each made with that device\'s own key.',
      'The three ciphertexts look completely different, even though the text is the same.',
      'Without the key the text can\'t be read — not even by Apple.',
    ],
    link: 'The receiving device will need the key — so next it\'s locked to that device.',
    shot: LANES_SHOT,
    state: () => ({ fog: 1,  idsRecords: 4 }),
    flows: [0, 1, 2].map((i) => ({ key: `ks${i}`, from: `en.barEnd${i}`, to: `en.ring${i}`, color: '#e2e8f0', speed: 0.9, count: 9, size: 0.08, lift: 0.25, alpha: (t) => win(lane(t, i), T.encrypt.pass[0], T.encrypt.pass[1]) })),
    labels: [
      { at: 'en.bar0', text: "iPhone's 128-bit key", sub: 'from the previous step', color: C.phone, dx: -60, dy: -110, when: [0, 1.6] },
      { at: 'en.ci0', text: 'Encrypted text', sub: "for Riley's iPhone", color: C.phone, dx: 60, dy: -110, when: [2.4, 99] },
      { at: 'en.ci2', text: '…and for the iPad and Mac', sub: 'each with its own key', color: C.mac, dx: -30, dy: 110, when: [2.8, 99] },
    ],
  },
  {
    id: 'wrap', chip: 'Lock key', group: 'send', cap: 'Locking the message key',
    kicker: 'Sending · Step 4', title: 'Lock the key to the receiving device',
    lead: 'The per-message AES key is encrypted using RSA-OAEP to the public key of the receiving device.',
    spec: { min: 'RSA-OAEP', rec: 'ECIES', minLabel: 'Key encryption', recLabel: 'iOS 13+ · iPadOS 13.1+ may use' },
    points: [
      'Each key is locked with the public key of <b>its own</b> receiving device.',
      'Only the device that holds the matching <b>private key</b> can unlock it.',
      'On iPhone with iOS 13 or later and iPad with iPadOS 13.1 or later, devices may use <b>Elliptic Curve Integrated Encryption Scheme (ECIES)</b> instead of RSA.',
    ],
    link: 'The encrypted text and the encrypted key now travel together.',
    shot: LANES_SHOT,
    state: () => ({ fog: 1,  idsRecords: 4 }),
    labels: [
      { at: 'wr.key1', text: "iPad's public key", sub: 'locks the iPad\'s copy of the key', color: C.pad, dx: 230, dy: 10, when: [T.wrap.key[0] + 0.4, T.wrap.turn[1] + 0.6] },
      { at: 'wr.lock0', text: 'Encrypted message key', sub: 'RSA-OAEP or ECIES', color: C.phone, dx: -60, dy: -120, when: [T.wrap.turn[1], 99] },
    ],
  },
  {
    id: 'sign', chip: 'Sign', group: 'send', cap: 'Hash, then sign',
    kicker: 'Sending · Step 5', title: 'Hash and sign',
    lead: 'The combination of the encrypted message text and the encrypted message key is hashed with SHA-1, and the hash is signed with ECDSA using the sending device\'s private signing key.',
    spec: { rows: [['SHA-1', 'hash of encrypted text + encrypted key', 'ids'], ['ECDSA', "signature with Alex's private signing key", 'sign']] },
    points: [
      'The signature shows which device sent the message and that it wasn\'t changed.',
      'The matching <b>public</b> signing key is in IDS, so receiving devices can check it.',
    ],
    link: 'Each device\'s package is now complete.',
    shot: LANES_SHOT,
    state: () => ({ fog: 1,  idsRecords: 4 }),
    labels: [
      { at: 'sg.tok0', text: 'SHA-1 hash', sub: 'of encrypted text + encrypted key', color: C.ids, dx: 170, dy: -70, when: [T.sign.scan[1], T.sign.stamps[0]] },
      { at: 'sg.key', text: "Alex's private signing key", sub: 'ECDSA signature', color: C.sign, dx: -40, dy: -130, when: [1.6, T.sign.back - 0.4] },
      { at: 'sg.seal2', text: 'Signed', sub: 'one signature per package', color: C.sign, dx: 170, dy: 50, when: [T.sign.stamps[2] + 0.3, 99] },
    ],
  },
  {
    id: 'package', chip: 'Package', group: 'send', cap: 'What gets sent',
    kicker: 'Sending · Step 6', title: 'One package per receiving device',
    lead: 'The resulting messages, one for each receiving device, consist of the encrypted message text, the encrypted message key and the sender\'s digital signature.',
    spec: { rows: [['Text', 'encrypted message text', 'phone'], ['Key', 'encrypted message key', 'phone'], ['Signature', "sender's digital signature", 'sign']] },
    points: [
      'Three receiving devices → <b>three packages</b>.',
      'For <b>group conversations</b>, this process is repeated for each recipient and their devices.',
    ],
    link: 'Next, the packages are dispatched to APNs for delivery.',
    shot: LANES_SHOT,
    state: () => ({ fog: 1,  idsRecords: 4 }),
    labels: [
      { at: 'pk.cap0', text: "Package for Riley's iPhone", sub: 'text + key + signature', color: C.phone, dx: 60, dy: -90 },
      { at: 'pk.ghost', text: 'Group conversation', sub: 'repeated for each recipient', color: '#e2e8f0', dx: 170, dy: -40, when: [T.package.ghost[0] + 0.3, 99] },
    ],
  },
  {
    id: 'apns', chip: 'To APNs', group: 'send', cap: 'On the way to APNs',
    kicker: 'Sending · Step 7', title: 'Dispatched to APNs over TLS',
    lead: 'The packages are dispatched to the Apple Push Notification service (APNs) for delivery.',
    points: [
      'Communication with APNs is encrypted using a <b>forward-secret TLS</b> channel.',
      '<b>Metadata</b>, such as the timestamp and APNs routing information, <b>isn\'t encrypted</b>.',
      'The message itself stays end-to-end encrypted — APNs relays it but can\'t read it.',
    ],
    link: 'APNs routes each package to the device it was encrypted for.',
    shot: { target: [-4.5, 4.5, -2.0], dir: [0.3, 0.15, 1], dist: 24 },
    state: (t) => ({ idsRecords: 4, apnsBusy: t > T.apns.leave + T.apns.ride ? 1 : 0 }), focus: ['apns'],
    flows: [{ key: 'tls', via: 'up', color: C.tls, speed: 0.32, count: 46, size: 0.12, alpha: (t) => k01(t, 0.2, 1.0) }],
    labels: [
      { at: 'ap.tunnel', text: 'Forward-secret TLS', sub: 'encrypted channel to APNs', color: C.tls, dx: -60, dy: -100 },
      { at: 'ap.meta', text: 'Metadata', sub: 'timestamp · routing — not encrypted', color: '#cbd5e1', dx: 150, dy: 60, when: [0, T.apns.leave + 1.2] },
      { at: 'apns', text: 'APNs', sub: 'relays the packages, can\'t read them', color: C.apns, dx: 170, dy: -30, when: [T.apns.leave + T.apns.ride, 99] },
    ],
  },
  {
    id: 'attach', chip: 'Attachments', group: 'send', cap: 'Too big for APNs? Use iCloud',
    kicker: 'Sending · Attachments', title: 'Photos and long messages go via iCloud',
    lead: 'APNs can only relay messages up to 4 or 16 KB in size, depending on the iOS or iPadOS version.',
    spec: { min: '4 or 16 KB', rec: 'AES-CTR · random 256-bit key', minLabel: 'APNs size limit', recLabel: 'Attachment encryption' },
    points: [
      'If the text is too long, or a photo or other attachment is included, the attachment is encrypted using <b>AES in CTR mode</b> with a randomly generated <b>256-bit key</b> and uploaded to <b>iCloud</b>.',
      'The attachment\'s <b>AES key</b>, its <b>URI</b> and an <b>SHA-1 hash</b> of its encrypted form are sent to the recipient as the contents of an iMessage.',
      'Those details are protected by normal iMessage encryption.',
    ],
    link: 'iCloud holds only the encrypted attachment; the key to open it travels inside the encrypted iMessage.',
    shot: { target: [-2.0, 5.5, -2.0], dir: [0.2, 0.4, 1], dist: 28 },
    state: (t) => ({ idsRecords: 4, cloudBlob: t > T.attach.up[1] - 0.1 ? 1 : 0 }), focus: ['cloud'],
    flows: [
      { key: 'upl', via: 'upload', color: C.cloud, speed: 0.4, count: 30, size: 0.12, alpha: (t) => win(t, T.attach.up[0], T.attach.up[1]) },
      { key: 'tls', via: 'up', color: C.tls, speed: 0.32, count: 40, size: 0.12, alpha: (t) => win(t, T.attach.go[0], T.attach.go[1]) },
    ],
    labels: [
      { at: 'at.tile', text: 'Photo', sub: (t) => (t < T.attach.enc[1] ? 'too big for APNs' : 'encrypted · random 256-bit key'), color: '#f59e0b', dx: -40, dy: -120, when: [0.4, T.attach.up[1] - 0.3] },
      { at: 'cloudBay', text: 'Stored in iCloud', sub: 'encrypted', color: C.cloud, dx: 150, dy: 60, when: [T.attach.up[1] - 0.2, 99] },
      { at: 'at.card', text: 'Key · URI · SHA-1 hash', sub: 'sent as a normal iMessage', color: C.send, dx: 140, dy: 60, when: [T.attach.card[0] + 0.2, T.attach.go[1] - 0.6] },
    ],
  },
  {
    id: 'deliver', chip: 'Delivery', group: 'receive', cap: 'APNs delivery',
    kicker: 'Receiving · Step 1', title: 'APNs delivers a copy to each device',
    lead: 'On the receiving side, each device receives its copy of the message from APNs.',
    points: [
      'As with all push notifications, the message is <b>deleted from APNs when it\'s delivered</b>.',
      'Unlike other APNs notifications, iMessage messages are <b>queued for delivery to offline devices</b>.',
      'Messages are stored on Apple servers for <b>up to 30 days</b>.',
    ],
    link: 'Here Riley\'s Mac is offline — its copy waits at APNs until the Mac is back online.',
    shot: { target: [3.5, 4.0, -4.0], dir: [-0.1, 0.2, 1], dist: 24 }, inset: 'hide',
    state: (t) => ({ idsRecords: 4, cloudBlob: 1, macOn: t < T.deliver.wake ? 0 : 1, macBadge: 1, macOnBadge: t < T.deliver.mac[1] + 1.5 ? 1 : 0, apnsBusy: 1 }),
    focus: ['rMac'],
    flows: [0, 1, 2].map((i) => ({ key: `dn${i}`, via: `down${i}`, color: C.tls, speed: 0.34, count: 30, size: 0.11, alpha: (t) => (i < 2 ? win(t, 0.4, T.deliver.pad[1] + 0.6) : win(t, T.deliver.wake + 0.2, T.deliver.mac[1])) })),
    labels: [
      { at: 'rMac', text: (t) => (deliverState(t).macOn ? 'Mac back online' : 'Mac offline'), sub: (t) => (deliverState(t).mac ? 'queued copy delivered' : deliverState(t).macOn ? 'receiving its copy…' : 'its copy waits at APNs'), color: C.mac, dx: 90, dy: -110 },
      { at: 'dl.clock', text: 'Queued at APNs', sub: 'stored for up to 30 days', color: '#fbbf24', dx: -190, dy: -30, when: [T.deliver.queue[1], T.deliver.mac[0]] },
      { at: 'apns', text: 'Deleted from APNs', sub: 'once a copy is delivered', color: C.apns, dx: -40, dy: -80, when: [T.deliver.phone[1] + 0.1, 99] },
    ],
  },
  {
    id: 'unlock', chip: 'Unlock', group: 'receive', cap: "On Riley's iPhone",
    kicker: 'Receiving · Step 2', title: 'Each device checks and decrypts its copy',
    lead: 'Each device can open only the copy that was encrypted for it, by reversing the sender\'s steps. Shown here on Riley\'s iPhone:',
    ordered: true,
    points: [
      '<b>Check the signature</b> with Alex\'s public signing key from IDS.',
      '<b>Unlock the message key</b> with the iPhone\'s own private key.',
      '<b>Decrypt the text</b> with AES-CTR.',
      '<b>Verify the 40-bit value</b> — the decrypted text is intact.',
      'The sender\'s phone number or email address is <b>matched to Riley\'s contacts</b> so a name can be displayed when possible.',
    ],
    link: 'Riley\'s iPad and Mac do the same, each with its own copy and its own private key.',
    note: 'The guide states steps 4 and 5 directly; steps 1–3 are the reverse of the sender\'s signing and encryption.',
    shot: { target: [3.2, 3.0, -0.6], dir: [-0.4, 0.16, 1], dist: 11.5 },
    state: (t) => ({ fog: 1,  idsRecords: 4, cloudBlob: 1, idsSeek: 1, idsAlex: t > T.unlock.sig[0] - 0.3 && t < T.unlock.ok + 0.4 ? 1 : 0 }), focus: ['rPhone'],
    labels: [
      { at: 'ul.seal', text: 'Signature checked', sub: "Alex's public key from IDS", color: C.sign, dx: 150, dy: -100, when: [T.unlock.sig[0] + 0.3, 99] },
      { at: 'ul.lock', text: 'Key unlocked', sub: "with the iPhone's private key", color: C.phone, dx: -130, dy: -110, when: [T.unlock.priv[0] + 0.5, 99] },
      { at: 'ul.bar', text: '40-bit check ✓', sub: 'the text is intact', color: C.phone, dx: 160, dy: 70, when: [T.unlock.check[0], T.unlock.show[0] + 0.4] },
      { at: 'rPhone', text: (t) => (unlockState(t).named ? `Shown as “${SENDER.name}”` : `From ${SENDER.phone}`), sub: 'matched to Riley\'s contacts', color: C.send, dx: 150, dy: -60, when: [T.unlock.show[0] + 0.3, 99] },
    ],
  },
  {
    id: 'fetch', chip: 'Get attachment', group: 'receive', cap: 'Fetching the attachment',
    kicker: 'Receiving · Step 3', title: 'Fetch the attachment from iCloud',
    lead: 'If necessary, the receiving device retrieves the attachment from iCloud. Shown here on Riley\'s iPad:',
    points: [
      'The decrypted iMessage carries the attachment\'s <b>URI</b>, its <b>256-bit AES key</b> and the <b>SHA-1 hash</b> of its encrypted form.',
      'The URI locates the encrypted attachment in iCloud; the hash lets the device check the download; the key decrypts it.',
    ],
    link: 'iCloud stores the attachment encrypted — only devices that received the iMessage have the key.',
    note: 'The guide lists what the iMessage carries (key, URI and hash); the download check and decryption shown here are how those are used.',
    shot: { target: [6.0, 5.2, -2.5], dir: [-0.2, 0.18, 1], dist: 19 },
    state: () => ({ fog: 1,  idsRecords: 4, cloudBlob: 1 }), focus: ['rPad'],
    flows: [
      { key: 'ask', via: 'dl1', reverse: true, color: C.send, speed: 0.6, count: 16, size: 0.1, alpha: (t) => win(t, T.fetch.ask[0], T.fetch.ask[1]) },
      { key: 'dlf', via: 'dl1', color: C.cloud, speed: 0.45, count: 26, size: 0.11, alpha: (t) => win(t, T.fetch.down[0], T.fetch.down[1]) },
    ],
    labels: [
      { at: 'ft.card', text: 'From the iMessage', sub: 'key · URI · hash', color: C.send, dx: -150, dy: -100, when: [0.5, T.fetch.show[0]] },
      { at: 'ft.tile', text: (t) => { const s = fetchState(t); return s.dec ? 'Decrypted' : s.hash ? 'SHA-1 hash matches' : 'Encrypted attachment'; }, sub: (t) => { const s = fetchState(t); return s.dec ? 'with the 256-bit key' : s.hash ? 'the download is intact' : 'downloaded from iCloud'; }, color: C.cloud, dx: 170, dy: -90, when: [T.fetch.down[0] + 0.6, T.fetch.show[0] + 0.2] },
    ],
  },
  {
    id: 'together', chip: 'Recap', group: 'end', cap: 'The whole journey',
    kicker: 'Putting it all together', title: 'The whole journey',
    ordered: true,
    points: [
      'Each device creates encryption and signing key pairs and registers its public keys and APNs address with <b>IDS</b>.',
      'The sender\'s device looks up the recipient\'s devices in IDS.',
      'For each device: a 128-bit key (88-bit random + 40-bit HMAC) encrypts the text with <b>AES-CTR</b>; the key is locked with <b>RSA-OAEP</b> or <b>ECIES</b>; the result is hashed (<b>SHA-1</b>) and signed (<b>ECDSA</b>).',
      'Packages travel to <b>APNs</b> over forward-secret TLS; large attachments go to <b>iCloud</b>, encrypted with a 256-bit key.',
      'Each receiving device gets its own copy, checks it, decrypts it and, if needed, fetches the attachment.',
    ],
    link: 'Message content is only readable on the sender\'s and recipients\' devices. Metadata such as the timestamp and APNs routing information isn\'t encrypted, and undelivered messages can wait on Apple servers for up to 30 days.',
    note: 'Good to know: Apple also deployed iMessage PQ3, a quantum-secure upgrade to iMessage encryption, in iOS 17.4, iPadOS 17.4, macOS 14.4 and watchOS 10.4 — covered in a different part of the Apple Platform Security guide.',
    shot: { target: [-0.5, 3.0, -4.0], dir: [0.1, 0.34, 1], dist: 33 }, sway: true, inset: 'hide',
    state: () => ({ idsRecords: 4 }),
    flows: [
      { key: 'tls', via: 'up', color: C.tls, speed: 0.32, count: 40, size: 0.12, alpha: (t) => win(t, T.together.up[0], T.together.up[1] + 0.6) },
      ...[0, 1, 2].map((i) => ({ key: `dn${i}`, via: `down${i}`, color: C.tls, speed: 0.34, count: 24, size: 0.11, alpha: (t) => win(t, T.together.down[0], T.together.down[1] + 0.4) })),
    ],
    labels: [
      { at: 'alex', text: 'Alex', sub: 'sender', color: C.send, dx: -30, dy: -110 },
      { at: 'riley', text: 'Riley', sub: 'recipient · 3 devices', color: C.phone, dx: 60, dy: -150 },
    ],
  },
];
export { after };
