import base64, pathlib, re, urllib.request

BLOCKS = pathlib.Path('/Users/ainazsadrtdinova/Desktop/Website/blocks/aroma')
SCR = pathlib.Path('/private/tmp/claude-501/-Users-ainazsadrtdinova-Desktop-Website/d04becaa-3991-4d1e-b26d-6eea64201462/scratchpad')
PUB = SCR / 'pub'

def data_uri(path, mime):
    return f'data:{mime};base64,' + base64.b64encode(pathlib.Path(path).read_bytes()).decode()

VIDEO = data_uri(BLOCKS / 'media' / 'hero-loop.mp4', 'video/mp4')
MEDIA = {
    'media/hero-loop-poster.jpg': data_uri(BLOCKS / 'media' / 'hero-loop-poster.jpg', 'image/jpeg'),
    'media/work-loop-poster.jpg': data_uri(PUB / 'poster.webp', 'image/webp'),
    'media/nozzle-close.jpg': data_uri(PUB / 'nozzle.webp', 'image/webp'),
    'media/ba-before.webp': data_uri(PUB / 'ba-before.webp', 'image/webp'),
    'media/ba-after.webp': data_uri(PUB / 'ba-after.webp', 'image/webp'),
}

faces = []
for line in (SCR / 'faces.txt').read_text().strip().split('\n'):
    name, weight, url, rng = line.split('\t')
    if weight != '400':
        continue
    b64 = base64.b64encode(urllib.request.urlopen(url).read()).decode()
    faces.append(
        "@font-face{font-family:'Golos Text';font-style:normal;font-weight:400 700;font-display:swap;"
        f"src:url(data:font/woff2;base64,{b64}) format('woff2');unicode-range:{rng};}}"
    )

RENAMES = {
    '03-proof.html': [('.sec', '.sec-proof'), ('class="sec"', 'class="sec-proof"'),
                      ('.head', '.head-proof'), ('class="head"', 'class="head-proof"')],
    '04-price.html': [('.sec', '.sec-price'), ('class="sec"', 'class="sec-price"')],
}

sections, styles, scripts = [], [], []
for f in ['01-hero.html', '02-process.html', '03-proof.html', '04-price.html', '05-faq.html', '06-contact.html']:
    src = (BLOCKS / f).read_text(encoding='utf-8')
    for a, b in RENAMES.get(f, []):
        src = src.replace(a, b)
    for k, v in MEDIA.items():
        src = src.replace(k, v)
    style = '\n'.join(re.findall(r'<style>(.*?)</style>', src, re.S))
    styles.append(f'/* {f} */\n{style}')
    body = re.search(r'<body>(.*?)</body>', src, re.S).group(1)
    scr = re.findall(r'<script>(.*?)</script>', body, re.S)
    body = re.sub(r'(?s)<script>.*?</script>', '', body).strip()
    sections.append(body)
    scripts.extend(scr)

merged_js = '\n'.join(scripts).replace(
    "s.src = 'media/hero-loop.mp4';",
    f"s.src = '{VIDEO}';")

tokens = (BLOCKS / 'tokens.css').read_text(encoding='utf-8')

page = f"""<meta charset="utf-8">
<title>Арома клининг, первый вариант</title>
<style>
{''.join(faces)}
{tokens}
{chr(10).join(styles)}
.top{{position:static;}}
img, video{{max-width:100%;}}
</style>
{chr(10).join(sections)}
<script>
{merged_js}
</script>
"""
out = BLOCKS / 'dist' / 'aroma-klining.html'
out.write_text(page, encoding='utf-8')
print('готово:', round(len(page.encode()) / 1024 / 1024, 2), 'МБ · видео вшито:', VIDEO[:30] in page)
