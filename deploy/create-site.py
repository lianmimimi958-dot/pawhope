#!/usr/bin/env btpython
import sys, os, json
sys.path.insert(0, '/www/server/panel/class')
sys.path.insert(0, '/www/server/panel')
os.chdir('/www/server/panel')
import public
from panelSite import panelSite

site = panelSite()
site_name = 'pawhope.cn'
path = '/www/wwwroot/pawhope.cn'
os.makedirs(path, exist_ok=True)

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
    get.ps = 'pawhope'
    get.ftp = 'false'
    get.sql = 'false'
    print('AddSite=', site.AddSite(get))
else:
    print('skip AddSite')

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
print('http=', os.popen('curl -s -o /dev/null -w "%{http_code}" -H "Host: pawhope.cn" http://127.0.0.1/').read())
