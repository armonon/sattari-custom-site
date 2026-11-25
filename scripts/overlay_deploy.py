"""Manifest-preserving overlay deploy for sattarimusic.com.

  python3 overlay_deploy.py draft   <dist> <function-build-dir|reuse> <receipt.json> <title>
  python3 overlay_deploy.py publish <receipt.json>

With `reuse` in place of a function build directory, the live function
archives are reused by digest (for releases that do not touch the backend);
the draft is abandoned if Netlify asks for any function upload.

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


def draft(dist, functions_dir, receipt_path, title):
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
    live_functions = {f['n']: f for f in live['available_functions']}
    reuse = functions_dir == 'reuse'
    # `<dir>:name,name` uploads only the named functions from the build and
    # reuses every other live archive by digest. A named function that is not
    # live yet is added, taking memory, region and priority from `template`.
    only = None
    if not reuse and ':' in functions_dir:
        functions_dir, names = functions_dir.rsplit(':', 1)
        only = set(names.split(','))
    reused = {name: {'digest': f['d'], 'buildData': f.get('bd')} for name, f in live_functions.items()}
    if reuse:
        built = reused
    else:
        manifest = json.loads((Path(functions_dir) / 'manifest.json').read_text())
        built = {f['name']: f for f in manifest['functions']}
        if only is not None:
            if only - set(built):
                raise SystemExit('Named function missing from the build')
            if set(built) - only != set(live_functions) - only:
                raise SystemExit('Function set differs from production beyond the named functions')
            built = {**reused, **{name: built[name] for name in only}}
    added = set(built) - set(live_functions)
    if set(live_functions) - set(built) or (added and (only is None or added - only)):
        raise SystemExit('Function set differs from production')
    template = live_functions['nightly-backup']
    schedules = list(live['function_schedules'])
    hashes, configs, function_uploads = {}, {}, {}
    for name, item in built.items():
        if 'digest' in item:
            digest = item['digest']
        else:
            archive = Path(item['path']).read_bytes()
            digest = hashlib.sha256(archive).hexdigest()
            function_uploads[digest] = (name, archive, item)
        hashes[name] = digest
        if name in added:
            if item.get('routes'):
                raise SystemExit('A new function with routes needs its routes reviewed by hand')
            if item.get('schedule'):
                schedules.append({'name': name, 'cron': item['schedule']})
        current = live_functions.get(name, {k: template.get(k) for k in ('m', 'p', 'rg')})
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
        'function_schedules': schedules,
        'environment': environment,
    }
    if edge and len(eszip) == 1:
        body['edge_functions'] = {'eszip2': eszip[0].rsplit('/', 1)[1][:-len('.eszip')]}
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
        'backend_reused_by_digest': reuse,
        'function_digests': hashes,
        'schedules': schedules,
        'functions_from_build': sorted(function_uploads[d][0] for d in function_uploads),
        'runtime_keys': sorted(v['key'] for v in environment),
        'published': False,
    }
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')

    if reuse and deploy.get('required_functions'):
        raise SystemExit('Netlify asked for function archives; draft left unpublished, production unchanged')
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
        draft(*sys.argv[2:6])
    elif sys.argv[1] == 'publish':
        publish(sys.argv[2])
    else:
        raise SystemExit(__doc__)
