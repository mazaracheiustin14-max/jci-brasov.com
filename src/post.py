# Post-procesare după build.py și build_en.py: 404 cu linkuri absolute, noindex pe paginile tehnice
import re
S='/home/claude/site/'
def noindex(s):
    s=re.sub(r'<link rel="(canonical|alternate)"[^>]*>\n','',s)
    s=re.sub(r'<meta (property="og:[^"]+"|name="twitter:[^"]+")[^>]*>\n','',s)
    return s.replace('<meta name="viewport"','<meta name="robots" content="noindex">\n<meta name="viewport"',1)
p=S+'404.html'; s=open(p,encoding='utf-8').read()
s=re.sub(r'(href|src)="(?!https?:|/|#|mailto:|tel:)([^"]+)"',lambda m:f'{m.group(1)}="/{m.group(2)}"',s)
s=s.replace('href="/en/404.html"','href="/en/"')
open(p,'w',encoding='utf-8').write(noindex(s))
for p in (S+'multumim.html',S+'en/multumim.html'):
    open(p,'w',encoding='utf-8').write(noindex(open(p,encoding='utf-8').read()))
print('post ok')
