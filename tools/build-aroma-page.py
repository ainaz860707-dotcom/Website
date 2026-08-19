import base64, pathlib, re, urllib.request

BLOCKS = pathlib.Path('/Users/ainazsadrtdinova/Desktop/Website/blocks/aroma')
SCR = pathlib.Path('/private/tmp/claude-501/-Users-ainazsadrtdinova-Desktop-Website/d04becaa-3991-4d1e-b26d-6eea64201462/scratchpad')
PUB = SCR / 'pub'

def data_uri(path, mime):
    return f'data:{mime};base64,' + base64.b64encode(pathlib.Path(path).read_bytes()).decode()

VIDEO = data_uri(BLOCKS / 'media' / 'hero-loop.mp4', 'video/mp4')
MEDIA = {
    'media/hero-still.webp': data_uri(BLOCKS / 'media' / 'hero-still.webp', 'image/webp'),
    'media/hero-loop-poster.jpg': data_uri(BLOCKS / 'media' / 'hero-loop-poster.jpg', 'image/jpeg'),
    'media/ba1-before.webp': data_uri(BLOCKS / 'media' / 'ba1-before.webp', 'image/webp'),
    'media/ba1-after.webp': data_uri(BLOCKS / 'media' / 'ba1-after.webp', 'image/webp'),
    'media/ba2-before.webp': data_uri(BLOCKS / 'media' / 'ba2-before.webp', 'image/webp'),
    'media/ba2-after.webp': data_uri(BLOCKS / 'media' / 'ba2-after.webp', 'image/webp'),
    'media/ba3-before.webp': data_uri(BLOCKS / 'media' / 'ba3-before.webp', 'image/webp'),
    'media/ba3-after.webp': data_uri(BLOCKS / 'media' / 'ba3-after.webp', 'image/webp'),
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
ORDER = ['01-hero.html', '08-services.html', '02-process.html', '03-proof.html',
         '04-price.html', '07-reviews.html', '05-faq.html', '06-contact.html']
for f in ORDER:
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
<title>Арома клининг — химчистка мебели на дому, Новосибирск</title>
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

LIGHT_SWITCH = "<script>document.documentElement.classList.add('t-light')</script>\n"
light = page.replace('<title>', LIGHT_SWITCH + '<title>', 1)
out_light = BLOCKS / 'dist' / 'aroma-klining-light.html'
out_light.write_text(light, encoding='utf-8')

wow_css = (BLOCKS / 'wow.css').read_text(encoding='utf-8')
wow_js = (BLOCKS / 'wow.js').read_text(encoding='utf-8')
gsap_lib = (BLOCKS / 'lib' / 'gsap.min.js').read_text(encoding='utf-8')
st_lib = (BLOCKS / 'lib' / 'ScrollTrigger.min.js').read_text(encoding='utf-8')
wow = page.replace('</style>', wow_css + '\n</style>', 1).rstrip()
wow += f'\n<script>{gsap_lib}</script>\n<script>{st_lib}</script>\n<script>\n{wow_js}\n</script>\n'
(BLOCKS / 'dist' / 'aroma-klining-wow.html').write_text(wow, encoding='utf-8')
wow_light = wow.replace('<title>', LIGHT_SWITCH + '<title>', 1)
(BLOCKS / 'dist' / 'aroma-klining-wow-light.html').write_text(wow_light, encoding='utf-8')

print('готово:', round(len(page.encode()) / 1024 / 1024, 2), 'МБ · видео вшито:', VIDEO[:30] in page,
      '· вариантов: 4')
