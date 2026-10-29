"""Local test-fixture typography only; never edits a product photograph.
Uses the existing Pillow test environment and OS fonts, no downloads.
"""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
root=Path('outputs/composer-demo');root.mkdir(parents=True,exist_ok=True)
paths=['C:/Windows/Fonts/segoeuib.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf','/System/Library/Fonts/Supplemental/Arial Bold.ttf']
path=next((p for p in paths if Path(p).exists()),None)
if not path:raise RuntimeError('Choose an installed local demo font; no font is downloaded')
font=lambda n:ImageFont.truetype(path,n)
w,h=1080,1920
body=Image.new('RGBA',(w,h),(0,0,0,0));draw=ImageDraw.Draw(body)
draw.rectangle((48,48,1032,158),fill=(10,12,17,184));draw.text((72,72),'YOUR BAKERY',font=font(34),fill='white')
for y in range(1480,h):draw.line((0,y,w,y),fill=(10,12,17,int((y-1480)/440*234)))
draw.text((72,1670),'The cookie collection.',font=font(52),fill='white');body.save(root/'overlay.png')
end=Image.new('RGB',(w,h),'#141519');draw=ImageDraw.Draw(end);draw.rectangle((72,260,192,266),fill='#a5b5ff');draw.text((72,330),'YOUR BAKERY',font=font(42),fill='white');draw.text((72,680),'The cookie\ncollection.',font=font(76),fill='white',spacing=14);draw.rectangle((72,1500,1008,1730),outline='#a5b5ff',width=2);draw.text((108,1555),'Explore the collection',font=font(42),fill='#dce2ff');end.save(root/'closing.png')
