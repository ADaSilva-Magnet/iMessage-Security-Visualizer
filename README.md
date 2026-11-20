iMessage - How Messages Are Sent and Received Securely - 3D Visualizer: SOURCE FILES
=====================================================================================

WHAT THIS FOLDER IS
This is the readable, editable version of iMessage-Secure-Messaging-Visualizer.html
(the file in the folder above). You do not need anything in here to present or share
the visualizer. Share only the .html file, not this folder.

It was built from the System Requirements 3D visualizer's source (same look, controls
and security lock), with a new scene and new content.


HOW TO GET A CHANGE MADE
1. Open the Code tab in Copilot and describe the change you want.
2. Tell Copilot that the source is in this folder (or attach the folder to the
   conversation) and ask it to rebuild the .html from this source.
3. Copilot should run the checks described below, then replace the .html file.

Do NOT edit the script part of the finished .html by hand. The file has a security
lock (a Content-Security-Policy holding a SHA-256 fingerprint of its script). Any
change to the script makes the browser refuse to run it, and the page stays on
"Building the scene...". build.py updates the fingerprint automatically.

Safe to edit by hand in the finished .html (outside the script): the top banner text,
the button names and the keyboard help screen.


WHERE THINGS ARE
src/steps.js       The 15 sections: titles, notes, bullet points, fact boxes, "How it fits
                   together" text, 3D labels (and when they appear), camera positions and
                   particle streams.
src/sync.js        The story data (Alex, Riley, the message) and the timing of every
                   animation, shared by the 3D scene, the labels and the close-ups.
src/rigs.js        The step-by-step 3D animation for each section (keys, key bits,
                   encryption, lock boxes, signatures, packages, delivery, decryption).
src/props.js       The 3D props those animations use (keys, lock box, seal, capsule...).
src/model.js       The stage: Alex's iPhone, Riley's iPhone/iPad/Mac, IDS, APNs and
                   iCloud, plus the flight paths between them.
src/palette.js     Colours and where everything stands on the stage.
src/screens.js     The "Close-up" diagrams (bottom-right panel) and what each device's
                   screen shows in each section (drawn in code).
src/main.js        Navigation, buttons, keyboard keys, links (#sign etc.), camera moves,
                   labels, notes panel, close-up panel and graphics quality.
src/textures.js    Generated textures (signs, records, photo, ciphertext...).
src/flows.js, util.js
                   Particle streams and small helpers.
src/template.html  The page shell: layout, styles, banner, buttons, help screen and
                   the security policy.
build.py           Builds the single .html file (see below).
package.json       Exact library versions: three 0.186.1, esbuild 0.27.7.
tests/             Automated browser checks (see below).


HOW TO REBUILD (for Copilot or a developer)
Needs Python 3 and Node.js.
1. If three and esbuild are not already available, run "npm install" in this folder.
2. Run:  python3 build.py
   Output: dist/iMessage-Secure-Messaging-Visualizer.html
   The build bundles all code (Three.js included) into one inline script, so the file
   works offline. It computes the script's SHA-256 and writes it into the security
   policy, and it stops if the inlined script would be unsafe.
3. Check it (next section), then replace the .html in the folder above with it.


CHECKS
Open the new file in Chrome or Edge and step through every section. In the Copilot
Code environment, the scripts in tests/ automate this (each takes the full path of the
.html; they use Playwright and the environment's Chromium, so adjust those paths to run
them elsewhere):
  node tests/sec.mjs <file> 1      Security: no network requests; an injected script,
                                   inline handler, eval-style timer and fetch are all
                                   blocked; test controls are absent.
  node tests/sec.mjs <file> 2      Booby-trapped link (HTML/script in the address):
                                   nothing runs, page opens normally on section 1.
  node tests/live.mjs <file>       Navigation: link #msgkey, arrow keys, Page Up,
                                   section buttons, Back, End. Expect no errors.
  node tests/nogl.mjs <file> <dir> Fallback when 3D graphics are unavailable.
  node tests/shot.mjs <file> <dir> all 1600 900 high
                                   Screenshots of every section (about 12 s each).
                                   Use e.g. "6@2.4,12@7" instead of "all" to capture a
                                   section at a given second of its animation.


SECURITY NOTES
- The page makes no network requests and stores nothing. The security policy blocks
  connections, outside images and scripts, inline event handlers and eval.
- A link can only choose a section (#keys, #sign, ... or ?step=sign) or lighter
  graphics (?q=low; ?q=high keeps full quality). Nothing from the address is written
  into the page.
- Test controls are off in the shared file. tests/shot.mjs turns them on by setting
  window.__VIZ_TEST__ = true before the page loads; a link cannot turn them on.


CONTENT
Based on the iMessage section of the Apple Platform Security guide, August 2026 edition
("iMessage security overview" and "How iMessage sends and receives messages securely").
The top bar names it as the source: "Source: Apple Platform Security Guide.pdf ·
August 2026" (in src/template.html). Every 3D scene and close-up diagram was drawn from
the guide's text; none of the guide's own figures are reproduced.
The Key pairs section adds general cryptography background that isn't guide text: a
short definition of asymmetric (public-key) cryptography, what each pair does
(encryption keeps messages private; signing proves who sent them) and why every device
needs both (it sends and receives). Its "How it fits together" note restates the later
steps: the message itself is encrypted with a one-time symmetric AES key, the
encryption pair locks that key and the signing pair signs the result.
The people, phone numbers, email addresses, the message text, the photo, the hex
values and the example attachment size are illustrations, not guide text. The device
screens are simplified illustrations, not Apple's actual interface.
On the receiving side the guide states that each device gets its copy from APNs,
fetches any attachment from iCloud, uses the 40-bit value to verify the decrypted
text and matches the sender to Contacts; the signature check, key unlock and
decryption shown before that are the reverse of the sender's steps.
