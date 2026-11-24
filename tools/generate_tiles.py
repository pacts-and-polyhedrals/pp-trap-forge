#!/usr/bin/env python3
"""Write the original Trap Forge map reveal textures. Standard library only."""
import math
import random
from pathlib import Path

OUTPUT = Path(__file__).resolve().parents[1] / 'assets' / 'tiles'
W = 256

def pt(x, y):
    return f'{x:.1f},{y:.1f}'

def points(seq):
    return ' '.join(pt(x,y) for x,y in seq)

def tag(name, body='', **attrs):
    attrs = ' '.join(f'{k.replace("_","-")}="{v}"' for k,v in attrs.items())
    return f'<{name} {attrs}>{body}</{name}>' if body else f'<{name} {attrs}/>'

def path(d, fill='none', stroke='none', stroke_width=1, **kw):
    return tag('path',d=d,fill=fill,stroke=stroke,stroke_width=stroke_width,
               stroke_linejoin='round',stroke_linecap='round',**kw)

def poly(coords, fill='none', stroke='none', stroke_width=1, **kw):
    return tag('polygon',points=points(coords),fill=fill,stroke=stroke,
               stroke_width=stroke_width,stroke_linejoin='round',**kw)

def rect(x,y,w,h,fill,**kw):
    return tag('rect',x=x,y=y,width=w,height=h,fill=fill,**kw)

def circle(x,y,r,fill='none',stroke='none',stroke_width=1,**kw):
    return tag('circle',cx=x,cy=y,r=f'{r:.1f}',fill=fill,stroke=stroke,stroke_width=stroke_width,**kw)

def ell(x,y,rx,ry,fill,**kw):
    return tag('ellipse',cx=x,cy=y,rx=rx,ry=ry,fill=fill,**kw)

def group(s,**kw):
    return tag('g',s,**kw)

def stop(offset,color,alpha=1):
    return tag('stop',offset=f'{offset}%',stop_color=color,stop_opacity=alpha)

def linear(id,seq, direction=('0%','0%','70%','100%')):
    return tag('linearGradient',''.join(stop(*x) for x in seq),id=id,x1=direction[0],y1=direction[1],x2=direction[2],y2=direction[3])

def radial(id,seq, cx='50%',cy='50%'):
    return tag('radialGradient',''.join(stop(*x) for x in seq),id=id,cx=cx,cy=cy)

def paint(id): return f'url(#{id})'

def gradient_palette():
    return ''.join([
      linear('stone',[(0,'#9b9c93'),(41,'#626863'),(100,'#353e44')]),
      linear('stone2',[(0,'#a49882'),(50,'#69686a'),(100,'#3e464b')]),
      linear('stone3',[(0,'#747a77'),(52,'#4d5557'),(100,'#28313a')]),
      linear('iron',[(0,'#758479'),(30,'#333b3a'),(65,'#202427'),(100,'#10191d')]),
      linear('brass',[(0,'#f4d69a'),(28,'#ad8050'),(63,'#4e3b27'),(100,'#cd9a57')]),
      linear('white-metal',[(0,'#fff2c1'),(18,'#acbeb8'),(46,'#536875'),(68,'#d0d7cf'),(100,'#626a6c')]),
      linear('wood',[(0,'#b78a59'),(51,'#62412a'),(100,'#302526')]),
      radial('hole',[(0,'#05060b'),(60,'#080a12'),(100,'#11141f')],cy='57%'),
      radial('shade',[(0,'#050207',.57),(53,'#080508',.36),(100,'#080508',0)]),
    ])

def grad_svg(s,defs=''):
    return '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">' + tag('defs',gradient_palette()+defs) + s + '</svg>\n'

def rng(i):
    return random.Random(i)

def spark(x,y,w,color,opacity=.9,rot=0):
    a=path(f'M{x-w},{y} Q{x},{y} {x},{y-w*1.55} Q{x},{y} {x+w},{y} Q{x},{y} {x},{y+w*1.55} Q{x},{y} {x-w},{y} Z',color,opacity=opacity)
    return group(a,transform=f'rotate({rot} {x} {y})') if rot else a

def polar(cx,cy,r,a,yr=1):
    return cx+r*math.cos(a),cy+r*yr*math.sin(a)

def rounded_irregular(cx,cy,rx,ry,n,seed,jitter=.13):
    g=rng(seed)
    return [(cx+(r:=g.uniform(1-jitter,1+jitter))*rx*math.cos((a:=math.tau*i/n)),cy+r*ry*math.sin(a)) for i in range(n)]

def marks(x,y, count=12,seed=16):
    g=rng(seed)
    s=''
    for i in range(count):
        xi=x+g.uniform(-26,26)
        yi=y+g.uniform(-18,18)
        s+=path(f'M{xi:.1f},{yi:.1f} l{g.uniform(2,8):.1f},{g.uniform(-2,2):.1f}',stroke=g.choice(['#24242d','#95978c','#555960','#c0bcb0']),stroke_width=g.uniform(.6,1.4),opacity=.46)
    return s

def grade(fill,palette=()):
    return linear(fill,palette)

def shadow(rx=126,ry=115):
    return ell(128,132,rx,ry,paint('shade'))

def bolt(x,y,r=4):
    return circle(x,y,r,'#15191a','#bda16e',1)+path(f'M{x-2},{y+1} l4,-2',stroke='#cfb588',stroke_width=.85,opacity=.7)

def diamond(x,y,w,he,col,stroke):
    return poly([(x,y-he),(x+w,y),(x,y+he),(x-w,y)],col,stroke,2)

def pit(open=True):
    s=shadow(127,123)
    outer=[(38,25),(82,18),(124,22),(170,17),(220,31),(231,61),(233,105),(240,152),(231,203),(220,222),(177,230),(125,227),(76,234),(34,220),(20,193),(22,150),(15,104),(24,58)]
    inner=[(51,45),(86,40),(122,44),(169,38),(199,53),(213,75),(211,112),(221,153),(211,188),(198,204),(174,207),(125,204),(79,213),(53,201),(41,180),(45,151),(34,105),(43,69)]
    s+=poly(outer,'#252930','#191c21',6)+poly(inner,paint('hole'),'#161922',3)
    for i in range(len(outer)):
        j=(i+1)%len(outer)
        o,p=outer[i],outer[j]
        a,b=inner[i],inner[j]
        s+=poly([o,p,b,a],paint(['stone','stone2','stone3','stone','stone3'][i%5]),'#383b3f',2.0)
        delta=(p[0]-o[0],p[1]-o[1])
        s+=path(f'M{pt(o[0]+delta[0]*.08,o[1]+delta[1]*.08)} L{pt(p[0]-delta[0]*.13,p[1]-delta[1]*.13)}',stroke='#c8bd99',stroke_width=2.2,opacity=.56)
        s+=path(f'M{pt(a[0]+(b[0]-a[0])*.2,a[1]+(b[1]-a[1])*.2)} L{pt(b[0],b[1])}',stroke='#171921',stroke_width=3)
        x=round((o[0]+p[0]+a[0]+b[0])/4,1); y=round((o[1]+p[1]+a[1]+b[1])/4,1)
        g=rng(i+19)
        s+=''.join(path(f'M{x+g.uniform(-6,6):.2f},{y+g.uniform(-5,5):.2f} l{g.uniform(2,6):.1f},-1.5',stroke=g.choice(['#e3dac0','#17232c','#25262c']),stroke_width=.85,opacity=.47) for _ in range(4))
    clip=tag('clipPath',poly(inner,'#fff'),id='mouth')
    if open:
        pitwall=path('M51 45 86 40 122 44 169 38 199 53 182 93 159 104 100 106 69 89Z',paint('backwall'),'#151822',1.5)
        pitwall+=path('M51 45 43 69 34 105 45 151 41 180 53 201 79 213 89 164 74 139 76 111 69 89Z',paint('leftwall'),'#14161f',1.8)
        pitwall+=path('M199 53 213 75 211 112 221 153 211 188 198 204 174 207 164 171 179 134 175 111 182 93Z',paint('rightwall'),'#14161f',1.8)
        pitwall+=path('M79 213 125 204 174 207 164 171 137 165 112 173 89 164Z',paint('frontwall'),'#11131a',1)
        pitwall+=path('M100 106 159 104 175 111 179 134 164 171 137 165 112 173 89 164 74 139 76 111 69 89Z','#07080f')
        for d in ['M57 60 84 59 114 65 155 59 190 67','M63 76 84 76 111 81 155 76 186 80','M85 40 89 62 82 75 87 90','M157 40 148 65 151 77 159 93','M43 77 54 92 56 119 62 136 62 159 77 182','M42 138 53 151 55 171 65 180 70 198','M206 81 196 94 193 127 199 147 192 173 186 186','M219 153 208 166 201 190 182 197']:
            pitwall+=path(d,stroke='#0c1018',stroke_width=1.7,opacity=.75)
        pitwall+=path('M51 47 85 42 124 45 169 40 198 55',stroke='#cac8a4',stroke_width=2,opacity=.73)
        pitwall+=path('M53 201 80 213 125 204 174 207 197 204',stroke='#b7af8b',stroke_width=2,opacity=.56)
        # Few tiny highlights glint inside the deep shaft, rather than drawing a floor over the void.
        pitwall+=path('M98 117 102 113 M162 109 l6 4 M157 163 l3 -4',stroke='#92948a',stroke_width=1.25,opacity=.38)
        s+=group(pitwall,clip_path=paint('mouth'))
    else:
        cover=rect(30,37,194,180,paint('wood'),rx=3)
        for x in range(38,222,23):
            cover+=path(f'M{x} 41 Q{x-4} 76 {x+1} 127 T{x-2} 211',stroke='#211813',stroke_width=2.5)
            cover+=path(f'M{x+7} 42 q-5 28 1 53 t1 39 m0 5 q6 21 1 55',stroke='#c29255',stroke_width=1.6,opacity=.45)
        for y in (70,178):
            cover+=poly([(30,y),(223,y+3),(221,y+14),(33,y+13)],paint('iron'),'#292625',2)
            for x in (49,76,113,146,181,207):
                cover+=bolt(x,y+7,2.8)
        cover+=path('M121 130 q0 -12 7 -12 8 0 8 12',stroke='#e1ba7e',stroke_width=5)
        s+=group(cover,clip_path=paint('mouth'))
    defs=clip + ''.join([
      linear('backwall',[(0,'#77796c'),(26,'#51584f'),(100,'#111523')]),
      linear('leftwall',[(0,'#5e6869'),(100,'#101421')],('0%','0%','100%','53%')),
      linear('rightwall',[(0,'#151924'),(100,'#575957')],('15%','70%','100%','0%')),
      linear('frontwall',[(0,'#0a0d16'),(100,'#42454a')],('60%','0%','60%','100%')),
    ])
    return grad_svg(s,defs)

def family_glow(color,x=128,y=134,rx=113,ry=107):
    d=radial('halo',[(0,color,.43),(61,color,.2),(100,color,0)])
    return ell(x,y,rx,ry,paint('halo')),d

def flame(x,y,sc,angle,variant=0, opacity=1):
    q=10*(variant%3)
    outer=f'M0,-92 Q{-5-q},-65 5,-48 Q20,-63 19,-78 Q{42+q},-57 38,-31 Q50,-41 49,-57 Q73,-40 62,-15 C49,22 14,36 -16,27 C-54,17 -59,-14 -39,-49 Q-43,-27 -21,-24 Q-36,-58 0,-92Z'
    inner='M2 -53 Q-3 -31 13 -23 Q18 -37 28 -46 Q45 -18 28 2 Q16 22 -5 20 Q-30 12 -25 -11 Q-17 -3 -12 -13 Q-16 -32 2 -53Z'
    hot='M8 -16 Q16 -2 8 15 Q-9 20 -13 4 Q-8 7 -4 -3 Q0 -11 8 -16Z'
    return group(path(outer,paint('flame'),'#d04519',1.7)+path(inner,paint('inner-fire'))+path(hot,'#fff5af'),
        transform=f'translate({x} {y}) rotate({angle}) scale({sc})',opacity=opacity)
def fire(wall=False):
    s=shadow()
    fdefs=linear('flame',[(0,'#ffd166'),(38,'#fabe51'),(69,'#f25d28'),(100,'#992024')],('50%','30%','50%','100%'))+linear('inner-fire',[(0,'#fff5a9'),(100,'#ffc254')],('50%','95%','50%','0%'))
    a,d=family_glow('#ee5221');s+=a
    if wall:
        s+=rect(21,48,55,160,paint('stone3'),rx=13,stroke='#242027',stroke_width=5)
        for i,y in enumerate((56,94,132,170)):
            s+=rect(26,y,46,31,paint('stone2' if i%2 else 'stone'),rx=3,stroke='#363331',stroke_width=2)
            s+=rect(44,y+7,24,18,'#20171a',rx=3)
        for i,(x,y,scale,alpha) in enumerate([(107,135,1.26,.70),(119,115,1,.92),(141,151,1,1),(168,126,.80,.91),(207,131,.45,.73)]):
            s+=flame(x,y,scale,86+(i%3-1)*16,i,alpha)
        for i in range(11):
            r=rng(100+i)
            x,y=r.uniform(77,228),r.uniform(83,180)
            s+=spark(x,y,r.uniform(1.1,4.2),'#ffdf8a',r.uniform(.45,.95),90)
    else:
        # Charred ground, radial burning lobes and a luminous core.
        s+=poly(rounded_irregular(127,137,90,72,20,14),'#3c2725','#6b3126',4,opacity=.75)
        for i in range(10):
            g=rng(13+i);angle=i*36+g.uniform(-13,13)
            x,y=polar(127,140,45,math.radians(angle-90),.82)
            s+=flame(round(x),round(y),round(g.uniform(.67,.92),2),round(angle,1),i,.87)
        for i in range(24):
            r=rng(90+i);a=math.tau*i/24
            x,y=polar(128,132,r.uniform(78,119),a,.86)
            s+=spark(round(x,1),round(y,1),r.uniform(1.2,4.2),r.choice(['#f07943','#ffcb69','#f8f1b0']),r.uniform(.52,.95),a*57)
        s+=flame(129,143,.98,-3)+flame(114,148,.60,-19,2,.96)
    return grad_svg(s+ell(128,146,45,31,'#ffc767',opacity=.21),d+fdefs)

def rockfall():
    s=shadow()
    s+=poly(rounded_irregular(129,135,104,87,19,42),'#474045','#5c514c',3,opacity=.80)
    for i,(x,y,rx,ry) in enumerate([(78,102,47,40),(155,85,58,48),(135,142,56,50),(78,169,43,39),(174,160,37,28),(185,183,43,25),(95,196,35,22),(51,139,25,23),(128,194,29,20)]):
        coords=rounded_irregular(x,y,rx,ry,8,112+i,.22)
        s+=poly([(a+3,b+7) for a,b in coords],'#242127',opacity=.7)
        s+=poly(coords,paint(['stone2','stone','stone3'][i%3]),'#20282a',2.5)
        mid=(x-rx*.16,y-ry*.27)
        s+=poly([coords[4],coords[5],coords[6],coords[7],mid],'#a39c8a',opacity=.48)
        s+=poly([coords[0],coords[1],coords[2],coords[3],mid],'#343a41',opacity=.51)
        s+=path(f'M{pt(*coords[5])} L{pt(*mid)} L{pt(*coords[0])}',stroke='#bbc1a6',stroke_width=1.35,opacity=.56)
        s+=path(f'M{pt(x-rx*.3,y-ry*.37)} l{rx*.13}, {ry*.24} {rx*.22}, {ry*.08} {rx*.12},{ry*.16}',stroke='#2c302f',stroke_width=1.5,opacity=.72)
    for i in range(27):
        g=rng(103+i);a=g.uniform(0,math.tau);x,y=polar(128,134,g.uniform(78,120),a)
        s+=poly(rounded_irregular(x,y,g.uniform(1.3,5),g.uniform(1.5,4.7),4,79+i),g.choice(['#736b65','#9b9580','#454345']),'#322e32',.8,opacity=.88)
    return grad_svg(s)

def plate():
    s=shadow(118,115)
    s+=poly([(41,207),(29,179),(34,66),(50,29),(206,29),(222,51),(229,184),(211,219),(51,222)],paint('stone3'),'#22252b',6)
    s+=rect(45,43,164,168,paint('iron'),rx=15,stroke='#191919',stroke_width=5)
    s+=rect(51,48,153,156,'none',rx=10,stroke='#be9661',stroke_width=2,opacity=.79)
    s+=rect(65,61,124,131,paint('stone3'),rx=8,stroke='#12181a',stroke_width=3)
    for x,y in [(59,55),(194,55),(59,197),(196,194)]:
        s+=bolt(x,y,5)
    for i in range(6):
        x=70+i*21
        s+=rect(x,68,10,116,'#171f23',rx=4,stroke='#737f71',stroke_width=1.4)
    s+=diamond(127,126,35,36,paint('iron'),'#b99b65')+diamond(127,126,24,25,'none','#d9ae75')+path('M127 108 v22 m0 8v3',stroke='#f6cd92',stroke_width=5)
    for x,y in [(52,29),(43,210),(202,29),(217,210)]: s+=marks(x,y,5,x*y)
    return grad_svg(s)

def blades():
    s=shadow()
    a,d=family_glow('#94382d',rx=104,ry=104);s+=a
    for rot in (0,90,180,270):
        arm=path('M134 119 L147 88 C169 70 202 69 222 42 L223 58 C216 83 195 109 165 118 L148 131Z',paint('white-metal'),'#283438',2.8)
        arm+=path('M162 105 Q191 92 211 66',stroke='#f8efcb',stroke_width=3,opacity=.9)
        arm+=path('M154 102 Q176 98 194 85 M177 84l8 -3',stroke='#34434a',stroke_width=1.5)
        arm+=path('M136 115 154 94 164 105 145 123Z',paint('brass'),'#291d1d',2)
        s+=group(arm,transform=f'rotate({rot} 128 128)')
    s+=circle(128,128,35,paint('iron'),'#221d20',4)+circle(128,128,28,paint('brass'),'#eacc8c',1.5)
    for i in range(8):
        x,y=polar(128,128,22,i*math.tau/8);s+=bolt(round(x,1),round(y,1),3.4)
    s+=circle(128,128,13,paint('iron'),'#ddc08a',2)
    return grad_svg(s,d)

def darts():
    s=shadow()
    for y in (70,105,139,174):
        s+=rect(21,y-10,55,23,paint('stone2'),rx=4,stroke='#242329',stroke_width=2)
        s+=ell(58,y+2,9,5,'#171922',stroke='#a4a096',stroke_width=1.5)
    a,d=family_glow('#c58c48',rx=112,ry=92);s+=a
    for x,y,r in [(123,82,-13),(156,111,5),(137,144,-7),(195,162,10),(97,182,14)]:
        shaft=path('M-64 0 -30 0 M-72 6 -46 6 M-51 -6 -33 -6',stroke='#d7a756',stroke_width=2,opacity=.52)+path('M-40 0 33 0',stroke='#23191b',stroke_width=7)+path('M-37 -1 30 -1',stroke='#d0a065',stroke_width=3)
        shaft+=path('M-40 0 -47 -9 -32 -7 -25 0 -31 7 -47 8Z','#b36942','#46272a',1.8)
        shaft+=path('M14 -10 45 0 14 10 20 0Z',paint('white-metal'),'#23272b',2)+path('M23 -2 41 0 24 2',stroke='#f9e5af',stroke_width=1.6)
        s+=group(shaft,transform=f'translate({x} {y}) rotate({r})')
    return grad_svg(s,d)

def smoke(acid=False,ice=False):
    color,deep,light=('#86b936','#324b22','#d9f897') if acid else (('#74ddef','#3c6178','#d7f8fa') if ice else ('#8fbc4c','#2e592f','#e2f793'))
    s=shadow()
    glow,d=family_glow(color);s+=glow
    d+=radial('cloud',[(0,light,.96),(42,color,.77),(82,deep,.56),(100,deep,0)])
    coats=[(56,142,41,30),(94,98,46,38),(132,143,53,43),(165,108,48,39),(180,156,45,38),(135,185,49,29),(88,177,43,31),(203,135,28,22),(70,116,27,21),(117,120,52,42)]
    if acid:
        s+=poly(rounded_irregular(129,134,88,71,22,109),paint('lake'),'#406330',3)
        d+=radial('lake',[(0,'#94bf3b'),(56,'#507f38'),(100,'#233927')])
        for j,(x,y,r) in enumerate([(68,134,10),(111,107,8),(137,146,19),(173,111,8),(173,158,12),(203,141,6),(93,170,7),(144,97,5),(157,186,9),(100,143,5)]):
            s+=circle(x,y,r,'#597f32','#a6da61',2,opacity=.95)+path(f'M{x-r*.53} {y-r*.33} q{r*.24} {-r*.43} {r*.65} {-r*.33}',stroke='#e8f9b1',stroke_width=2,opacity=.79)
        s+=path('M60 147 Q78 191 119 181 M149 82 Q181 91 199 116 M190 163 l-10 12',stroke='#b9f584',stroke_width=3,opacity=.71)
        coats=[(56,149,35,19),(154,99,33,22),(206,138,29,20),(103,177,34,19),(119,110,34,23)]
    for x,y,rx,ry in coats:
        s+=ell(x,y,rx,ry,paint('cloud'),opacity=.52 if acid else .77)
    for i in range(16):
        g=rng(24+i);x,y=g.uniform(52,207),g.uniform(86,193)
        s+=path(f'M{x:.1f} {y:.1f} q{g.uniform(8,20):.1f},-7 {g.uniform(18,28):.1f},1',stroke=light,stroke_width=g.uniform(.8,2.9),opacity=g.uniform(.18,.54),)
    return grad_svg(s,d)

def frost():
    s=shadow()
    a,d=family_glow('#6bd5e8');s+=a
    d+=linear('ice',[(0,'#d9fcf7'),(36,'#67c8dd'),(73,'#3981a4'),(100,'#21435d')])
    s+=poly(rounded_irregular(129,137,107,80,18,26),paint('ice'),'#79daef',2,opacity=.65)
    for i in range(14):
        g=rng(108+i);a=i*math.tau/14;x,y=polar(127,145,g.uniform(35,83),a,.72)
        ht=g.uniform(23,64);ww=g.uniform(9,18); dx=g.uniform(-12,12)
        q=[(x-ww,y),(x+dx,y-ht),(x+ww,y-4),(x+4,y+ww*.94)]
        s+=poly(q,paint('ice'),'#8cdded',1.6,opacity=.92)
        s+=poly([q[0],q[1],q[3]],'#b1eaf3',opacity=.36)
        s+=path(f'M{pt(*q[1])} L{pt(*q[3])}',stroke='#effaf5',stroke_width=1.3,opacity=.9)
        s+=spark(round(x+dx,1),round(y-ht,1),g.uniform(1.3,3.7),'#ddfff9',g.uniform(.58,.95))
    for i in range(7):
        a=i*math.tau/7;x,y=polar(128,136,36,a,.79);xb,yb=polar(128,136,96,a,.79)
        s+=path(f'M{pt(x,y)} l12,8 L{pt(xb,yb)}',stroke='#c8f4fb',stroke_width=1.5,opacity=.47)
    return grad_svg(s,d)

def flood():
    s=shadow();a,d=family_glow('#319fca');s+=a
    d+=radial('lake',[(0,'#4d9ebb'),(57,'#246686'),(100,'#163e55')])
    s+=poly(rounded_irregular(126,132,105,85,21,20),paint('lake'),'#4aa6bb',3,opacity=.91)
    for j,(x,y) in enumerate([(38,104),(67,82),(49,119),(124,113),(87,153),(123,176),(155,136),(57,178),(154,181),(176,103),(105,68)]):
        k=rng(j+77);l=k.randint(19,56)
        s+=path(f'M{x} {y} q{l*.27:.1f} 13 {l*.60:.1f} 4 t{l*.62:.1f} 1',stroke=k.choice(['#c8f7e5','#7bced6','#5cbbd0','#b2e9da']),stroke_width=k.uniform(1.4,4.6),opacity=k.uniform(.53,.94))
    s+=path('M32 146 Q51 163 76 145 T121 148 T172 150 T218 140 M41 188 Q62 208 91 190 T144 188 T203 180',stroke='#c9f5e7',stroke_width=4,opacity=.76)
    for i in range(24):
        g=rng(19+i);a=g.uniform(0,math.tau);x,y=polar(129,129,g.uniform(70,111),a,.76)
        s+=circle(round(x,1),round(y,1),g.uniform(1.3,3.5),'#bdf6e5',opacity=g.uniform(.27,.72))
    return grad_svg(s,d)

def lightning():
    s=shadow(116,116);a,d=family_glow('#67a6ff');s+=a
    s+=circle(128,128,87,'#375aa0','#5d94ee',2,opacity=.26)
    for i,r in enumerate((61,79,96)):
        s+=circle(128,128,r,'none',['#668ff1','#9cdaf7','#7283d0'][i],2,opacity=(.57,.68,.24)[i],stroke_dasharray=['5 14','4 9','2 7'][i])
    paths=['M49 41 97 76 92 101 133 127 120 151 177 179 173 204 223 219','M37 185 63 162 81 164 112 139 133 127 171 118 169 88 203 48','M119 20 137 49 119 68 145 94 133 127','M133 127 158 155 133 194 140 223','M132 126 93 115 74 125 51 118 30 133','M173 179 200 162 221 170']
    for i,p in enumerate(paths):
        s+=path(p,stroke='#3456b2',stroke_width=10 if i==0 else 7,opacity=.50)
        s+=path(p,stroke='#73aafb',stroke_width=6 if i==0 else 4,opacity=.85)
        s+=path(p,stroke='#e0feff',stroke_width=2.6 if i==0 else 1.8)
    for x,y in [(131,126),(48,41),(203,49),(221,218),(61,161),(175,179),(119,20)]:
        s+=spark(x,y,5,'#e0feff',.92,27)
    return grad_svg(s,d)

def rune(palette='violet', portal=False, dark=False, wave=False):
    dark_color,mid,light={'violet':('#492b62','#a264d5','#ebcbff'),'emerald':('#17373d','#4a9a85','#c2efca'),'gold':('#6f471f','#d6973a','#ffe4a2'),'ink':('#232039','#7450a0','#ba95dc'),'air':('#254661','#6da6b3','#cff7dc')}[palette]
    s=shadow();a,d=family_glow(mid);s+=a
    d+=radial('pool',[(0, dark_color,.9),(56,mid,.34),(100,dark_color,.44)])
    if wave:
        for i,r in enumerate((94,77,60,44,28)):
            for j in range(4):
                aa=j*math.tau/4+[.10,.27,.34,.45,.64][i]
                x,y=polar(128,132,r,aa,.84);xb,yb=polar(128,132,r,aa+1.22,.84)
                s+=path(f'M{pt(x,y)} A{r} {r*.84} 0 0 1 {pt(xb,yb)}',stroke=light if i%2 else mid,stroke_width=6-i*.67,opacity=.39+i*.1)
        for i in range(17):
            g=rng(i+14);a=g.uniform(0,math.tau);x,y=polar(128,132,g.uniform(69,112),a,.89)
            s+=spark(round(x,1),round(y,1),g.uniform(1.8,3.2),light,g.uniform(.5,.9))
        s+=spark(128,133,12,light,1)
        return grad_svg(s,d)
    s+=circle(128,128,96,dark_color,'#120f23',4,opacity=.86)
    s+=circle(128,128,87,paint('pool'),mid,2.6,opacity=.84)
    s+=circle(128,128,76,'none',light,1.9,opacity=.8,stroke_dasharray='2 8')
    s+=circle(128,128,61,'none',mid,2.2,opacity=.68)
    if portal or dark:
        d+=radial('vortex',[(0,'#070719'),(39,dark_color),(75,mid),(100,dark_color)])
        s+=circle(128,128,58,paint('vortex'),light,1.5,opacity=.93)
        for k in range(6):
            a=k*math.tau/6;x,y=polar(128,128,52,a)
            x1,y1=polar(128,128,43,a+1.0);x2,y2=polar(128,128,22,a+1.54)
            s+=path(f'M{pt(x,y)} Q{pt(x1,y1)} {pt(x2,y2)} Q128 133 127 128',stroke=light,stroke_width=2.8,opacity=.65)
        s+=circle(128,128,11,'#070719',mid,1.7)
    else:
        for j in (0,1):
            p=[polar(128,128,57,math.tau*(k/3+j/6)-math.pi/2) for k in range(3)]
            s+=poly(p,'none',light,1.6,opacity=.79)
        s+=diamond(128,128,17,26,mid,light)+spark(128,128,9,light)
    glyphs=['M-6 6 -6 -6 6 -6 M0 -6 0 6 6 6','M-6 5 0 -6 6 5 M-3 1 3 1','M2 -7 -6 -1 6 1 -2 7','M-6 -5 0 5 6 -5 M0 5 0 8']
    for i in range(12):
        a=i*math.tau/12;x,y=polar(128,128,83,a)
        s+=group(path(glyphs[i%4],stroke=light,stroke_width=1.5,opacity=.91),transform=f'translate({round(x,1)} {round(y,1)}) rotate({i*30+90})')
    for i in range(8):
        a=i*math.tau/8;x,y=polar(128,128,105,a);s+=spark(round(x,1),round(y,1),3.7,light,.82,i*45)
    return grad_svg(s,d)

def alarm():
    s=shadow(120,108); a,d=family_glow('#d69d42');s+=a
    for i in range(3):
        r=71+i*19
        s+=path(f'M{128-r*.77:.1f} {154-r*.62:.1f} Q{128-r*1.3:.1f} 120 {128-r*.64:.1f} {149+r*.56:.1f} M{128+r*.77:.1f} {154-r*.62:.1f} Q{128+r*1.3:.1f} 120 {128+r*.64:.1f} {149+r*.56:.1f}',stroke='#e2a34e',stroke_width=5-i,opacity=.88-.2*i)
    s+=path('M87 104 Q91 69 126 67 Q163 69 167 104 L174 142 Q179 158 193 162 L193 171 Q129 190 64 171 L64 161 Q78 156 82 141Z',paint('brass'),'#473227',3.5)
    s+=path('M68 163 Q129 174 188 164 M93 106 Q96 84 118 79',stroke='#ffdc9d',stroke_width=3.5,opacity=.87)
    s+=ell(128,173,61,13,'#633e26',stroke='#f7ca78',stroke_width=2.4)+ell(128,172,41,7,'#2e2223')
    s+=circle(128,184,12,paint('brass'),'#392520',2)+path('M120 66 Q119 51 128 49 Q137 48 136 66',stroke='#c39352',stroke_width=5)
    s+=spark(182,106,5,'#ffe2a5',.92)+spark(68,202,4,'#f1c875',.85)
    return grad_svg(s,d)

def mimic():
    s=shadow()
    s+=poly(rounded_irregular(128,132,104,81,18,616),paint('stone3'),'#2a1c24',4)
    s+=path('M34 133 Q40 79 97 68 Q127 60 165 75 Q211 87 225 131 Q210 174 165 187 Q124 198 78 177 Q44 163 34 133Z',paint('lip'),'#211922',5)
    s+=path('M49 132 Q57 93 108 89 Q131 84 163 93 Q198 102 210 132 Q192 162 161 171 Q127 184 87 169 Q54 157 49 132Z',paint('hole'),'#2d151a',4)
    for i in range(13):
        x=55+i*11.8;t=abs((x-128)/77)
        y=90+43*t*t+2*math.sin(i)
        z=173-38*t*t+3*math.sin(i+2)
        r=rng(100+i);depth=r.randrange(11,28)
        s+=path(f'M{x:.1f} {y:.1f} q-3 {depth*.6} 6 {depth} q8 {-depth*.45} 7 {-depth}Z',paint('tooth'),'#3c302e',1.4)
        s+=path(f'M{x+4:.1f} {z:.1f} q-3 {-depth*.65} 5 {-depth*.8} q8 {depth*.5} 7 {depth*.8}Z',paint('tooth'),'#3c302e',1.4)
    s+=path('M105 159 C94 145 108 140 122 147 Q130 152 143 144 Q158 151 148 162Z','#7b324d','#b34e61',2)
    s+=path('M57 113 Q130 66 195 111 M64 164 Q94 186 128 182',stroke='#cf8090',stroke_width=3.2,opacity=.57)
    for x,y in [(55,70),(197,69)]:
        s+=ell(x,y,17,11,'#292528',stroke='#88705c',stroke_width=1.7)+ell(x,y,10,7,'#e1b355')+ell(x+1,y+1,3,6,'#141018')
    return grad_svg(s,linear('lip',[(0,'#a15d67'),(28,'#5e383e'),(69,'#471f31'),(100,'#853748')])+linear('tooth',[(0,'#fff1c1'),(100,'#a59369')]))

def snare(vines=False):
    s=shadow(112,112)
    a,d=family_glow('#6c9d54' if vines else '#bf955d');s+=a
    base='#354728' if vines else '#68482d';light='#9aaf64' if vines else '#e6bd76'
    mid='#748e49' if vines else '#b88a4a'
    loops=['M27 159 C61 187 117 216 175 193 C229 171 233 108 185 72 C137 37 69 59 47 108 C22 161 79 205 129 172 C165 153 179 95 147 84 C106 64 91 96 107 121 C118 140 144 136 169 108',
           'M47 43 C96 64 172 40 175 90 C176 114 151 137 115 137 C76 136 54 156 70 179 C88 205 145 199 183 175 C213 154 238 135 218 108']
    for k,p in enumerate(loops):
        s+=path(p,stroke='#201f22',stroke_width=11-k*2,opacity=.91)+path(p,stroke=base,stroke_width=8-k)+path(p,stroke=mid,stroke_width=5-k,opacity=.84)+path(p,stroke=light,stroke_width=1.6,opacity=.79,stroke_dasharray='2 8')
    if vines:
        for i in range(28):
            g=rng(i+16);a=i*math.tau/28;x,y=polar(127,129,g.uniform(56,101),a,.84)
            s+=group(path('M0,0 Q12,-9 24,-2 Q17,14 0,0Z','#648247','#a0b36b',1.25)+path('M3 1 Q14 -1 21 -2',stroke='#bfcb8a',stroke_width=1),transform=f'translate({round(x,1)} {round(y,1)}) rotate({i*31})')
    else:
        s+=path('M114 133 q14 -14 26 0 t-17 9 q-15 -3 -1 -16 t20 11',stroke='#251b16',stroke_width=13)
        s+=path('M114 133 q14 -14 26 0 t-17 9 q-15 -3 -1 -16 t20 11',stroke='#dba663',stroke_width=8)
        s+=path('M114 133 q14 -14 26 0 t-17 9 q-15 -3 -1 -16 t20 11',stroke='#edcb8c',stroke_width=2,opacity=.85)
    return grad_svg(s,d)

ART = {
 'pit-open': lambda:pit(True), 'pit-closed':lambda:pit(False),
 'fire-blast':lambda:fire(False), 'fire-jet':lambda:fire(True),
 'rockfall':rockfall,'pressure-plate':plate,'blade':blades,'darts':darts,
 'poison':smoke,'frost':frost,'acid':lambda:smoke(acid=True),'flood':flood,'lightning':lightning,
 'rune':rune,'alarm':alarm,'mimic':mimic,'snare':snare,'shockwave':lambda:rune('air',wave=True),
 'shadow':lambda:rune('ink',dark=True),'magic-portal':lambda:rune('emerald',portal=True),'vines':lambda:snare(True),
}

def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for slug, renderer in ART.items():
        (OUTPUT / f'{slug}.svg').write_text(renderer(),encoding='utf-8')

if __name__ == '__main__':
    main()
