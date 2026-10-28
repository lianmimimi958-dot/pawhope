#!/usr/bin/env btpython
import sys, os
sys.path.insert(0, '/www/server/panel/class')
sys.path.insert(0, '/www/server/panel')
os.chdir('/www/server/panel')
import public
from panelSite import panelSite

site_name = 'pawhope.cn'
base = '/www/server/panel/vhost/letsencrypt/{}'.format(site_name)
key = public.readFile(base + '/privkey.pem')
csr = public.readFile(base + '/fullchain.pem')
print('key_ok=', bool(key), 'csr_ok=', bool(csr))

get = public.dict_obj()
get.siteName = site_name
get.key = key
get.csr = csr
print('SetSSL=', panelSite().SetSSL(get))

get2 = public.dict_obj()
get2.siteName = site_name
try:
    print('HttpToHttps=', panelSite().HttpToHttps(get2))
except Exception as e:
    print('HttpToHttps err=', e)

public.serviceReload()
print('nginx=', public.checkWebConfig())
print('cert_file=', os.path.exists('/www/server/panel/vhost/cert/{}/fullchain.pem'.format(site_name)))
