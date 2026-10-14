"""Wrap the single-file build (dist-artifact/index.html) as a Claude artifact page body."""
import re, sys
s = open('dist-artifact/index.html').read()
# Library code contains literal '<body>' strings, so split on the last occurrences.
head, rest = s[s.index('<head>') + 6:].rsplit('</head>', 1)
body = rest.rsplit('<body>', 1)[1].rsplit('</body>', 1)[0]
parts = []
for m in re.finditer(r'(<script\b[^>]*>)(.*?)(</script>)|<style\b.*?</style>', head, re.S):
    if m.group(1):
        js = m.group(2)
        # Keep the HTML parser from leaving the script early on markup inside library strings.
        js = js.replace('<!--', '\\x3C!--').replace('<script', '\\x3Cscript').replace('</script', '\\x3C/script')
        parts.append(m.group(1) + js + m.group(3))
    else:
        parts.append(m.group(0))
out = ('<title>MoneyMap</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
       '<meta name="theme-color" content="#1d6a66">\n' + '\n'.join(parts) + '\n' + body)
open(sys.argv[1], 'w').write(out)
print('wrote', sys.argv[1], len(out))
