"""Build iMessage-Secure-Messaging-Visualizer.html from src/.

Usage:  python3 build.py
Output: dist/iMessage-Secure-Messaging-Visualizer.html (one self-contained file, no internet needed).

Needs Python 3 and Node.js with three@0.186.1 and esbuild@0.27.7 (see package.json). It looks for them in
$VIZ_NODE_MODULES, then ./node_modules (run "npm install" here), then the Copilot Code environment's copy.
"""
import base64, hashlib, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
NAME = 'iMessage-Secure-Messaging-Visualizer.html'
WANT = {'three': '0.186.1', 'esbuild': '0.27.7'}


def fail(msg):
    sys.exit('BUILD FAILED: ' + msg)


def find_node_modules():
    for nm in (os.environ.get('VIZ_NODE_MODULES'), os.path.join(HERE, 'node_modules'),
               '/opt/appbuilder/templates/v1/node_modules'):
        if not nm:
            continue
        for exe in ('esbuild', 'esbuild.cmd'):
            if os.path.isfile(os.path.join(nm, 'three', 'package.json')) and os.path.exists(os.path.join(nm, '.bin', exe)):
                return nm, os.path.join(nm, '.bin', exe)
    fail('three and esbuild not found. Run "npm install" in this folder, or set VIZ_NODE_MODULES.')


nm, esbuild = find_node_modules()
for pkg, want in WANT.items():
    got = json.load(open(os.path.join(nm, pkg, 'package.json'), encoding='utf-8'))['version']
    if got != want:
        print(f'WARNING: {pkg} is {got}; this visualizer was built and tested with {want}.', file=sys.stderr)

# 1) Bundle src/main.js and everything it imports (incl. Three.js) into one minified script (printed to stdout).
r = subprocess.run([esbuild, os.path.join(HERE, 'src', 'main.js'), '--bundle', '--minify', '--format=iife',
                    '--target=es2020', '--legal-comments=eof', '--log-level=warning'],
                   env={**os.environ, 'NODE_PATH': nm}, capture_output=True, text=True, encoding='utf-8')
sys.stderr.write(r.stderr)
if r.returncode:
    sys.exit(r.returncode)
js = r.stdout

# 2) The bundle is inlined into one <script> element. Nothing in it may end that element early or switch the
#    HTML parser into a different script state. esbuild already escapes "</script" in any case; the build
#    stops (rather than rewriting code, which could break it) if any such text remains.
if re.search(r'</script|<script|<!--', js, flags=re.I):
    fail('bundle contains "</script", "<script" or "<!--"; inlining it would not be safe')

tpl = open(os.path.join(HERE, 'src', 'template.html'), encoding='utf-8').read()
if tpl.count('/*__BUNDLE__*/') != 1:
    fail('bundle marker must appear exactly once in the template')
html = tpl.replace('/*__BUNDLE__*/', js, 1)  # str.replace: no backslash or group interpretation
if '\r' in html or '\0' in html:
    fail('CR or NUL characters found (the browser would normalise them and the CSP hash would no longer match)')

opens, closes = re.findall(r'<script\b', html, re.I), re.findall(r'</script', html, re.I)
bodies = re.findall(r'<script>(.*?)</script>', html, flags=re.S)
if not (len(opens) == len(closes) == len(bodies) == 1):
    fail(f'expected exactly one inline <script> (found {len(opens)} open / {len(closes)} close)')

# 3) Security lock (Content-Security-Policy): allow only this exact script to run.
digest = 'sha256-' + base64.b64encode(hashlib.sha256(bodies[0].encode('utf-8')).digest()).decode()
if html.count('__CSP_SCRIPT_HASH__') != 1:
    fail('CSP hash placeholder must appear exactly once')
html = html.replace('__CSP_SCRIPT_HASH__', digest)

os.makedirs(os.path.join(HERE, 'dist'), exist_ok=True)
dst = os.path.join(HERE, 'dist', NAME)
with open(dst, 'w', encoding='utf-8', newline='\n') as f:
    f.write(html)
print(json.dumps({'output': os.path.relpath(dst, HERE), 'html_kb': round(len(html.encode()) / 1024),
                  'csp_script_hash': digest}))
