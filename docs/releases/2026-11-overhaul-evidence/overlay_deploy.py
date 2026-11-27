"""Manifest-preserving overlay deploy for sattarimusic.com (2026-11-22).

  python3 overlay_deploy.py draft   <dist> <function-build-dir> <receipt.json>
  python3 overlay_deploy.py publish <receipt.json>

Draft: every file of the current production deploy is kept; files from <dist>
replace or add (dotfiles excluded). All function archives come from
<function-build-dir> (built from this repo; their sources match the live
backend except reviewed changes). Each function keeps the live deploy's routes,
memory, region, priority, traffic rules; schedules and the edge function are
reused. Production-context runtime values are bound to the draft in memory only
(never written). Nothing is published.

Publish: rechecks that production still points at the deploy the draft was
built against, then publishes that exact draft. Rollback: publish the
`previous_deploy` id in the receipt the same way.
"""
import concurrent.futures
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

SITE = '53a43ab7-fd89-4b5b-902e-6bc0e36c58b2'  # "sattari", custom domain sattarimusic.com
API = 'https://api.netlify.com/api/v1'
config = json.loads(Path('~/Library/Preferences/netlify/config.json').expanduser().read_text())
auth = config['users'][config['userId']]['auth']
TOKEN = auth.get('token') if isinstance(auth, dict) else auth


def api(path, data=None, method=None, raw=None, content='application/json'):
    body = raw if raw is not None else (json.dumps(data).encode() if data is not None else None)
    request = urllib.request.Request(
        API + path,
        data=body,
        method=method,
        headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': content},
    )
    for attempt in range(6):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                text = response.read()
                return json.loads(text) if text else {}
        except urllib.error.HTTPError as error:
            if error.code in (429, 500, 502, 503) and attempt < 5:
                time.sleep(min(60, 5 * (attempt + 1)))
                continue
            raise SystemExit(f'Netlify API {error.code} for {path.split("?")[0]}') from None


def published():
    return (api('/sites/' + SITE).get('published_deploy') or {}).get('id')


def draft(dist, functions_dir, receipt_path):
    receipt_path = Path(receipt_path)
    if receipt_path.exists():
        raise SystemExit('Receipt exists; inspect it before creating another draft')
    site = api('/sites/' + SITE)
    if site.get('custom_domain') != 'sattarimusic.com':
        raise SystemExit('Unexpected site')
    previous = site['published_deploy']['id']
    live = api('/deploys/' + previous)

    # Static: live files kept, build files replace/add.
    files = {f['path']: f['sha'] for f in api('/sites/' + SITE + '/files')}
    lower = {path.casefold(): path for path in files}
    uploads = {}
    dist = Path(dist)
    for path in sorted(dist.rglob('*')):
        if not path.is_file():
            continue
        relative = '/' + path.relative_to(dist).as_posix()
        if any(part.startswith('.') for part in relative.split('/')[1:]):
            continue
        sha = hashlib.sha1(path.read_bytes()).hexdigest()
        key = lower.get(relative.casefold(), relative)
        files[key] = sha
        uploads[sha] = (key, path)

    # Functions: archives from this repo, configuration from the live deploy.
    manifest = json.loads((Path(functions_dir) / 'manifest.json').read_text())
    built = {f['name']: f for f in manifest['functions']}
    live_functions = {f['n']: f for f in live['available_functions']}
    if set(built) != set(live_functions):
        raise SystemExit('Function set differs from production')
    hashes, configs, function_uploads = {}, {}, {}
    for name, item in built.items():
        archive = Path(item['path']).read_bytes()
        digest = hashlib.sha256(archive).hexdigest()
        hashes[name] = digest
        function_uploads[digest] = (name, archive, item)
        current = live_functions[name]
        entry = {}
        for short, long in [('dn', 'display_name'), ('g', 'generator'), ('m', 'memory'),
                            ('p', 'priority'), ('rg', 'region'), ('tr', 'traffic_rules')]:
            if current.get(short) is not None:
                entry[long] = current[short]
        entry['build_data'] = item.get('buildData')
        entry['routes'] = [
            {long: route[short] for short, long in [('p', 'pattern'), ('l', 'literal'),
             ('e', 'expression'), ('m', 'methods'), ('ps', 'prefer_static')]
             if route.get(short) is not None}
            for route in current.get('ro', [])
        ]
        configs[name] = entry

    # Production-context runtime values, in memory only.
    environment = []
    for variable in api('/accounts/' + site['account_id'] + '/env?site_id=' + SITE):
        scopes = [s for s in variable.get('scopes', []) if s in ('functions', 'runtime')]
        if not scopes:
            continue
        values = {v.get('context'): v.get('value') for v in variable.get('values', [])}
        value = values.get('production', values.get('all'))
        if value is not None:
            environment.append({'key': variable['key'], 'value': value, 'scopes': scopes,
                                'is_secret': True})

    edge = live.get('edge_functions_present')
    eszip = [p for p in files if p.startswith('/.netlify/internal/edge-functions/') and p.endswith('.eszip')]
    body = {
        'files': files,
        'draft': True,
        'functions': hashes,
        'functions_config': configs,
        'function_schedules': live['function_schedules'],
        'environment': environment,
    }
    if edge and len(eszip) == 1:
        body['edge_functions'] = {'eszip2': eszip[0].rsplit('/', 1)[1][:-len('.eszip')]}
    title = 'Flagship tools: practice tools, console and readout (main 562c238)'
    deploy = api('/sites/' + SITE + '/deploys?title=' + urllib.parse.quote(title), body, 'POST')
    deploy_id = deploy['id']
    receipt = {
        'id': deploy_id,
        'site_id': SITE,
        'previous_deploy': previous,
        'title': title,
        'files': len(files),
        'replaced_or_added_from_build': len(uploads),
        'functions': len(hashes),
        'function_digests': hashes,
        'schedules': live['function_schedules'],
        'runtime_keys': sorted(v['key'] for v in environment),
        'published': False,
    }
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')

    required = set(deploy.get('required') or [])
    def put_file(sha):
        key, path = uploads[sha]
        api(f'/deploys/{deploy_id}/files' + urllib.parse.quote(key), raw=path.read_bytes(),
            method='PUT', content='application/octet-stream')
    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        list(pool.map(put_file, [sha for sha in required if sha in uploads]))
    missing = required - set(uploads)
    if missing:
        raise SystemExit(f'Netlify requires {len(missing)} files not in the build; draft left unpublished')
    for digest in deploy.get('required_functions') or []:
        name, archive, item = function_uploads[digest]
        query = urllib.parse.urlencode({
            'runtime': item.get('runtimeVersion') or item.get('runtime') or 'js',
            'invocation_mode': item.get('invocationMode') or '',
        })
        api(f'/deploys/{deploy_id}/functions/{urllib.parse.quote(name)}?{query}', raw=archive,
            method='PUT', content='application/octet-stream')
    for _ in range(120):
        state = api('/deploys/' + deploy_id)
        if state['state'] in ('ready', 'error'):
            break
        time.sleep(5)
    receipt.update({'state': state['state'], 'error': state.get('error_message'),
                    'draft_url': state.get('deploy_ssl_url'),
                    'uploaded_files': len(required), 'uploaded_functions': len(deploy.get('required_functions') or [])})
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({k: receipt[k] for k in ('id', 'state', 'draft_url', 'files', 'uploaded_files', 'uploaded_functions', 'error')}))


def publish(receipt_path):
    receipt_path = Path(receipt_path)
    receipt = json.loads(receipt_path.read_text())
    if receipt.get('state') != 'ready':
        raise SystemExit('Draft is not ready')
    if published() != receipt['previous_deploy']:
        raise SystemExit('Production changed since the draft was made; re-review needed')
    result = api(f'/sites/{SITE}/deploys/{receipt["id"]}/restore', {}, 'POST')
    receipt.update({'published': True, 'published_at': result.get('published_at')})
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'published': result.get('id'), 'at': result.get('published_at'),
                      'rollback_to': receipt['previous_deploy']}))


if __name__ == '__main__':
    if sys.argv[1] == 'draft':
        draft(*sys.argv[2:5])
    elif sys.argv[1] == 'publish':
        publish(sys.argv[2])
    else:
        raise SystemExit(__doc__)
