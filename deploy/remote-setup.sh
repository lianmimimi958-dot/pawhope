#!/bin/bash
set -e
APP=/www/wwwroot/pawhope
SITE=/www/wwwroot/pawhope.cn
mkdir -p "$APP" "$SITE"
tar -xzf /tmp/pawhope-deploy.tgz -C "$APP"
if id www >/dev/null 2>&1; then chown -R www:www "$APP" "$SITE"; fi
cd "$APP"
pm2 delete pawhope >/dev/null 2>&1 || true
pm2 start server/index.js --name pawhope --cwd "$APP"
pm2 save
sleep 1
echo -n "local3680="
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3680/

# Create Baota site + reverse proxy via panel API
btpython <<'PY'
import json, public, os
from panelSite import panelSite

site = panelSite()
site_name = 'pawhope.cn'
path = '/www/wwwroot/pawhope.cn'
os.makedirs(path, exist_ok=True)

# already exists?
exists = public.M('sites').where('name=?', (site_name,)).count()
print('site_exists=', exists)

if not exists:
    get = public.dict_obj()
    get.webname = json.dumps({
        'domain': site_name,
        'domainlist': ['www.pawhope.cn'],
        'count': 1
    })
    get.path = path
    get.type_id = 0
    get.type = 'PHP'
    get.version = '00'
    get.port = '80'
    get.ps = 'pawhope爪印日记'
    get.ftp = 'false'
    get.sql = 'false'
    print('AddSite=', site.AddSite(get))
else:
    print('skip AddSite')

# create proxy if missing
proxyfile = '{}/data/proxyfile.json'.format(public.get_panel_path())
proxies = []
if os.path.exists(proxyfile):
    raw = public.readFile(proxyfile) or '[]'
    try:
        proxies = json.loads(raw)
    except Exception:
        proxies = []
have = any(p.get('sitename') == site_name and p.get('proxyname') == 'pawhope' for p in proxies)
print('proxy_exists=', have)
if not have:
    get = public.dict_obj()
    get.sitename = site_name
    get.proxyname = 'pawhope'
    get.proxydir = '/'
    get.proxysite = 'http://127.0.0.1:3680'
    get.todomain = '$host'
    get.type = 1
    get.cache = 0
    get.advanced = 0
    get.cachetime = 1
    get.subfilter = json.dumps([
        {'sub1': '', 'sub2': ''},
        {'sub1': '', 'sub2': ''},
        {'sub1': '', 'sub2': ''}
    ])
    print('CreateProxy=', site.CreateProxy(get))
else:
    print('skip CreateProxy')

public.serviceReload()
print('nginx_ok=', public.checkWebConfig())
PY

echo -n "http_host="
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: pawhope.cn" http://127.0.0.1/
echo DONE
