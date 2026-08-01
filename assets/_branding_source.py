import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SS = 4  # supersample
S = 1024 * SS
FONT = '/home/osamah/.fonts/Cairo_900Black.ttf'

def bg_gradient(size, c1, c2, angle=45):
    w = h = size
    x = np.linspace(0, 1, w, dtype=np.float32)
    y = np.linspace(0, 1, h, dtype=np.float32)
    X, Y = np.meshgrid(x, y)
    if angle == 90:
        t = Y
    else:
        t = (X + Y) / 2.0
    c1 = np.array(c1, dtype=np.float32)
    c2 = np.array(c2, dtype=np.float32)
    g = c1[None, None, :] * (1 - t)[..., None] + c2[None, None, :] * t[..., None]
    return Image.fromarray(np.uint8(g)).convert('RGBA')

# ---- ICON: rounded bg + shield + keyhole ----
icon = bg_gradient(S, (124, 116, 255), (37, 30, 120))
d = ImageDraw.Draw(icon)
# rounded-rect mask
mask = Image.new('L', (S, S), 0)
dm = ImageDraw.Draw(mask)
dm.rounded_rectangle([0, 0, S - 1, S - 1], radius=220 * SS, fill=255)
# subtle top-left highlight
hl = Image.new('RGBA', (S, S), (0, 0, 0, 0))
dhl = ImageDraw.Draw(hl)
dhl.ellipse([-200 * SS, -200 * SS, 640 * SS, 640 * SS], fill=(255, 255, 255, 26))
icon.alpha_composite(hl)

# shield (white gradient)
sh_mask = Image.new('L', (S, S), 0)
ds = ImageDraw.Draw(sh_mask)
ds.polygon([
    (512, 172), (640, 228), (700, 300), (700, 555),
    (700, 555), (652, 690), (570, 760), (512, 795),
    (454, 760), (372, 690), (324, 555),
    (324, 300), (384, 228)
], fill=255)
shield = bg_gradient(S, (255, 255, 255), (214, 208, 255))
shield = bg_gradient(S, (255, 255, 255), (204, 198, 255), angle=90)
# subtle inner edge
edge = Image.new('L', (S, S), 0)
de = ImageDraw.Draw(edge)
de.polygon([(512, 172), (640, 228), (700, 300), (700, 555),
            (652, 690), (570, 760), (512, 795), (454, 760), (372, 690), (324, 555),
            (324, 300), (384, 228)], fill=255)
edge = edge.filter(ImageFilter.GaussianBlur(6 * SS))
de = ImageDraw.Draw(edge)
de.line([(512, 172), (640, 228), (700, 300), (700, 555),
         (652, 690), (570, 760), (512, 795), (454, 760), (372, 690), (324, 555),
         (324, 300), (384, 228)], fill=0, width=10 * SS)
icon.alpha_composite(shield)
d = ImageDraw.Draw(icon)

# keyhole gradient (indigo)
kh = bg_gradient(S, (111, 99, 255), (56, 44, 170))
khm = Image.new('L', (S, S), 0)
dkm = ImageDraw.Draw(khm)
dkm.ellipse([512 - 96 * SS, 420 - 96 * SS, 512 + 96 * SS, 420 + 96 * SS], fill=255)
dkm.rounded_rectangle([512 - 46 * SS, 420 + 40 * SS, 512 + 46 * SS, 596 * SS], radius=46 * SS, fill=255)
kh.putalpha(khm)
icon.alpha_composite(kh)
d = ImageDraw.Draw(icon)
# keyhole inner shadow (dark rim)
rim = Image.new('L', (S, S), 0)
drm = ImageDraw.Draw(rim)
drm.ellipse([512 - 96 * SS, 420 - 96 * SS, 512 + 96 * SS, 420 + 96 * SS], fill=255)
drm.ellipse([512 - 66 * SS, 420 - 66 * SS, 512 + 66 * SS, 420 + 66 * SS], fill=0)
drm.rounded_rectangle([512 - 46 * SS, 420 + 40 * SS, 512 + 46 * SS, 596 * SS], radius=46 * SS, fill=255)
drm.rounded_rectangle([512 - 30 * SS, 420 + 52 * SS, 512 + 30 * SS, 582 * SS], radius=30 * SS, fill=0)
rim = rim.filter(ImageFilter.GaussianBlur(4 * SS))
rm_img = Image.new('RGBA', (S, S), (30, 20, 90, 120))
rm_img.putalpha(rim)
icon.alpha_composite(rm_img)

icon = icon.resize((1024, 1024), Image.LANCZOS)
icon.save('icon-v2.png')
print('icon ok')
