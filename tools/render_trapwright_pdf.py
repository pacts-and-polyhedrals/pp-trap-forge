from pathlib import Path
import re,sys,html
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, PageBreak, KeepTogether, CondPageBreak
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
base=Path('/usr/share/fonts/truetype/dejavu')
for f,n in [('DejaVuSerif.ttf','TWSerif'),('DejaVuSerif-Bold.ttf','TWSerifBold'),('DejaVuSans.ttf','TWSans'),('DejaVuSans-Bold.ttf','TWSansBold')]:
 pdfmetrics.registerFont(TTFont(n,str(base/f)))
pdfmetrics.registerFontFamily('TWSerif',normal='TWSerif',bold='TWSerifBold',italic='TWSerif',boldItalic='TWSerifBold')
pdfmetrics.registerFontFamily('TWSans',normal='TWSans',bold='TWSansBold',italic='TWSans',boldItalic='TWSansBold')
hex=colors.HexColor
ink=hex('#272530');gold=hex('#936321');muted=hex('#584b52');navy=hex('#282137')
s={
 'body':ParagraphStyle('Body',fontName='TWSerif',fontSize=9.65,leading=13.1,textColor=ink,spaceAfter=5.6),
 'small':ParagraphStyle('Small',fontName='TWSans',fontSize=7.8,leading=11.1,textColor=ink),
 'col':ParagraphStyle('Column',fontName='TWSansBold',fontSize=8,leading=11,textColor=colors.white),
 'title':ParagraphStyle('Title',fontName='TWSerifBold',fontSize=37,leading=42,textColor=navy,spaceAfter=7),
 'subtitle':ParagraphStyle('Subtitle',fontName='TWSansBold',fontSize=9,leading=13,textColor=gold,spaceAfter=19),
 'h2':ParagraphStyle('Heading',fontName='TWSerifBold',fontSize=22,leading=28,textColor=navy,spaceBefore=8,spaceAfter=10,keepWithNext=True),
 'h3':ParagraphStyle('Feature',fontName='TWSansBold',fontSize=11,leading=15,textColor=gold,spaceBefore=8,spaceAfter=4,keepWithNext=True),
 'bullet':ParagraphStyle('Bullet',fontName='TWSerif',fontSize=9.4,leading=14.3,textColor=ink,leftIndent=12,firstLineIndent=-9,spaceAfter=4),
}
W,H=A4; margin=45; width=W-margin*2
def inline(x):
 x=x.replace('—',' - ').replace('–','-').replace('‑','-')
 y=html.escape(x).replace('  ',' ')
 y=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',y)
 y=re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)',r'<i>\1</i>',y)
 return y.replace('`','')
def para(x,k='body'):return Paragraph(inline(x),s[k])
def table(rows):
 vals=[]
 for row in rows:
  if re.fullmatch(r'\|(?:\s*:?-{3,}:?\s*\|)+',row):continue
  vals.append([v.strip() for v in row.strip().strip('|').split('|')])
 n=len(vals[0]); col=([width*.35,width*.65] if n==2 else [width*.10,width*.13,width*.19,width*.58] if n==4 else [width/n]*n)
 data=[[para(x,'col' if i==0 else 'small') for x in r] for i,r in enumerate(vals)]
 t=Table(data,colWidths=col,repeatRows=1,hAlign='LEFT')
 t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),navy),('ROWBACKGROUNDS',(0,1),(-1,-1),[hex('#f3ede2'),hex('#fbf7ef')]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3),('LINEBELOW',(0,-1),(-1,-1),.56,hex('#c8bdb0'))]))
 return t
path=Path(__file__).resolve().parents[1]/'trapwright'/'TRAPWRIGHT.md'
raw=path.read_text()
sections=['Ironwork Engineer','Sigil Binder','Wildway Warden','Mawkeeper']
main,index=raw.split('## Schematic index',1)
extras={}
for name in sections:
 match=re.search(r'\*\*'+name+r' \(\d+\)\*\*\s*\n((?:\n?- \*\*Level[^\n]+\n){4})',index)
 if not match: raise RuntimeError(name)
 extras[name]=match.group(1)
story=[]; cur=None
def add_extras():
 if cur in extras:
  story.append(para('Portable schematic unlocks','h3'))
  for l in extras[cur].splitlines():
   if l.startswith('- '):story.append(para('• '+l[2:],'bullet'))
lines=main.splitlines();i=0
while i<len(lines):
 l=lines[i].strip();i+=1
 if not l:continue
 if l.startswith('|'):
  b=[l]
  while i<len(lines) and lines[i].startswith('|'):b.append(lines[i]);i+=1
  story.extend([KeepTogether([table(b)]) if len(b)<9 else table(b),Spacer(1,10)]);continue
 if l.startswith('## '):
  name=l[3:]
  add_extras()
  if name in sections or name in ('Trapwright progression','Class Features','Foundry play and adjudication'):story.append(PageBreak())
  cur=name;story.append(para(name,'h2'));continue
 if l.startswith('### '):
  if l.startswith('### Level 1: Practice Schematics'):story.append(CondPageBreak(108))
  story.append(para(l[4:],'subtitle' if i<5 else 'h3'));continue
 if l.startswith('# '):story.append(para(l[2:],'title'));continue
 if l.startswith('- '):story.append(para('• '+l[2:],'bullet'));continue
 story.append(para(l))
add_extras()
def deco(c,d):
 c.saveState();c.setFillColor(hex('#fcf9f0'));c.rect(0,0,W,H,0,1)
 c.setStrokeColor(hex('#c4ac86'));c.setLineWidth(.7);c.line(margin,H-35,W-margin,H-35)
 c.setFillColor(muted);c.setFont('TWSansBold',7);c.drawString(margin,H-27,'PACTS & POLYHEDRALS')
 c.setFont('TWSans',7);c.drawRightString(W-margin,H-27,'TRAP FORGE   /   PLAYER CLASS PLAYTEST')
 c.line(margin,35,W-margin,35);c.setFont('TWSans',7);c.drawString(margin,23,'THE TRAPWRIGHT   /   2024 D&D')
 c.drawRightString(W-margin,23,f'{d.page:02}')
 c.restoreState()
out=Path(sys.argv[1] if len(sys.argv)>1 else 'Trapwright-Playtest-Rulebook.pdf')
doc=SimpleDocTemplate(str(out),pagesize=A4,rightMargin=margin,leftMargin=margin,topMargin=50,bottomMargin=52,title='The Trapwright - 2024 D&D Playtest',author='Pacts & Polyhedrals')
doc.build(story,onFirstPage=deco,onLaterPages=deco)
