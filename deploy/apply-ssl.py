#!/usr/bin/env btpython
import sys, os, json
sys.path.insert(0, '/www/server/panel/class')
sys.path.insert(0, '/www/server/panel')
os.chdir('/www/server/panel')
import public
from acme_v2 import acme_v2
from panelSite import panelSite

site_name = 'pawhope.cn'
row = public.M('sites').where('name=?', (site_name,)).find()
print('site=', row)
if not row:
    raise SystemExit('site missing')

args = public.dict_obj()
args.id = str(row['id'])
args.siteName = site_name
args.domains = json.dumps([site_name, 'www.pawhope.cn'])
args.auth_type = 'http'
args.auth_to = row['path']
args.auto_wildcard = '0'

print('applying...')
res = acme_v2().apply_cert_api(args)
print('apply=', res)

# force HTTPS if cert exists
cert_dir = '/www/server/panel/vhost/cert/{}'.format(site_name)
print('cert_exists=', os.path.exists(os.path.join(cert_dir, 'fullchain.pem')))
if os.path.exists(os.path.join(cert_dir, 'fullchain.pem')):
    get = public.dict_obj()
    get.siteName = site_name
    get.type = '1'
    try:
        print('HttpToHttps=', panelSite().HttpToHttps(get))
    except Exception as e:
        print('HttpToHttps err=', e)
public.serviceReload()
print('done')
