from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
import shutil
import subprocess
import math

ROOT = "/home/dev/Projects/khoebo/khoebo-demo"
ASSETS = os.path.join(ROOT, "assets")
GRAPHICS = os.path.join(ASSETS, "graphics")
TEMP = os.path.join(ROOT, "project", "render-temp-v2")
RAW = os.path.join(ROOT, "khoebo-raw-recording.webm")
MUSIC = os.path.join(ASSETS, "soundtrack", "nastelbom-deep-house-351574.mp3")
OUTPUT = os.path.join(ROOT, "khoebo-promo.mp4")
LOGO = "/home/dev/Projects/khoebo/assets/logo.jpg"
SIZE = (1080, 1920)
W, H = SIZE
FPS = 30
TRANSITION = 0.6
BEATS = [5.0, 9.5, 13.5, 17.5, 22.4, 26.8, 31.0, 35.4, 45.5]
DURATION = 50.0
INK = (32, 26, 22)
ORANGE = (233, 107, 26)
ORANGE_DARK = (196, 82, 13)
CREAM = (255, 241, 232)
MUTED = (203, 189, 179)
WHITE = (255, 255, 255)
ENV = os.environ.copy()
ENV["LD_LIBRARY_PATH"] = "/tmp/opencode/khoebo-work/lib"
FONT_CACHE = {}

SCENES = [
    {"name": "intro", "kind": "graphic", "duration": 4.7},
    {"name": "dashboard", "kind": "raw", "duration": 3.9, "source": (10.2, 4.0), "speed": 1.0, "caption": ("Everything in one place", "A live view of your business")},
    {"name": "sell", "kind": "raw", "duration": 3.4, "source": (20.2, 3.5), "speed": 1.0, "caption": ("Sell in seconds", "Tap. Add. Done.")},
    {"name": "receipt", "kind": "raw", "duration": 3.4, "source": (34.0, 3.5), "speed": 1.0, "caption": ("Sale recorded", "Payment, tax and totals handled")},
    {"name": "stock", "kind": "raw", "duration": 4.3, "source": (48.0, 4.4), "speed": 1.0, "caption": ("Stock stays visible", "Know what you have")},
    {"name": "reports", "kind": "raw", "duration": 3.8, "source": (60.0, 3.9), "speed": 1.0, "caption": ("The books stay balanced", "Income and expenses in focus")},
    {"name": "bookkeeping", "kind": "raw", "duration": 3.6, "source": (74.0, 3.7), "speed": 1.0, "caption": ("Every transaction", "Neatly recorded")},
    {"name": "analytics", "kind": "raw", "duration": 3.8, "source": (86.0, 3.9), "speed": 1.0, "caption": ("Know what is working", "Insights at a glance")},
    {"name": "dashboard_return", "kind": "raw", "duration": 9.5, "source": (10.5, 7.5), "speed": 1.2712, "caption": ("Business, simplified", "One connected workspace")},
    {"name": "outro", "kind": "graphic", "duration": 4.2}
]

MASK_TYPES = ["circle", "diagonal", "panels", "wipe", "diamond", "vertical", "circle", "diagonal", "wipe"]
MASK_POINTS = [(540, 860), (0, 1920), (0, 0), (0, 0), (540, 960), (0, 0), (540, 980), (1080, 1920), (1080, 0)]


def run(cmd):
    print("RUN", " ".join(cmd))
    subprocess.run(cmd, check=True, env=ENV)


def font_path(style):
    return subprocess.check_output(["fc-match", "-f", "%{file}", style]).decode().strip()


def font(style, size):
    key = (style, size)
    if key not in FONT_CACHE:
        FONT_CACHE[key] = ImageFont.truetype(font_path(style), size)
    return FONT_CACHE[key]


def clamp(value, low=0.0, high=1.0):
    return max(low, min(high, value))


def ease_out(value):
    value = clamp(value)
    return 1 - (1 - value) ** 3


def ease_in_out(value):
    value = clamp(value)
    if value < 0.5:
        return 4 * value ** 3
    return 1 - ((-2 * value + 2) ** 3) / 2


def fade(value, start, end):
    return clamp((value - start) / (end - start))


def text_layer(image, xy, value, style, size, fill, anchor="mm"):
    layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.text(xy, value, font=font(style, size), fill=fill, anchor=anchor)
    image.alpha_composite(layer)


def brand_base():
    image = Image.new("RGBA", SIZE, INK + (255,))
    lines = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(lines)
    for x in range(-900, 1800, 130):
        draw.line((x, 0, x + 860, 1920), fill=(233, 107, 26, 20), width=2)
    image = Image.alpha_composite(image, lines)
    glow = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    for radius in range(620, 0, -14):
        alpha = int((1 - radius / 620) * 24)
        draw.ellipse((540 - radius, 720 - int(radius * 0.72), 540 + radius, 720 + int(radius * 0.72)), fill=ORANGE + (alpha,))
    image = Image.alpha_composite(image, glow)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, W, 12), fill=ORANGE + (255,))
    draw.rectangle((0, 1908, W, H), fill=ORANGE_DARK + (255,))
    return image


def logo_layer(width):
    logo = Image.open(LOGO).convert("RGBA")
    ratio = width / logo.width
    return logo.resize((width, int(logo.height * ratio)), Image.Resampling.LANCZOS)


def paste_logo(image, top, width, opacity=1.0):
    logo = logo_layer(width)
    if opacity < 1.0:
        alpha = logo.getchannel("A").point(lambda value: int(value * opacity))
        logo.putalpha(alpha)
    image.alpha_composite(logo, ((W - logo.width) // 2, top))


def light_sweep(image, progress, strength=55):
    if progress <= 0 or progress >= 1:
        return image
    layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    center = -900 + progress * 2900
    alpha = int(strength * math.sin(math.pi * progress))
    draw.polygon([(center - 180, -100), (center + 180, -100), (center + 900, 2020), (center + 540, 2020)], fill=(255, 214, 170, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(34))
    image.alpha_composite(layer)
    return image


def make_intro_frames():
    out = os.path.join(TEMP, "intro")
    os.makedirs(out, exist_ok=True)
    frames = int(4.7 * FPS)
    for index in range(frames):
        p = index / (frames - 1)
        image = brand_base()
        draw = ImageDraw.Draw(image)
        title_alpha = int(255 * fade(p, 0.05, 0.28))
        text_layer(image, (540, 145), "KHOEBO / PRODUCT FILM", "Roboto:style=Bold", 26, MUTED + (title_alpha,))
        paste_logo(image, int(320 - 30 * ease_out(fade(p, 0.02, 0.3))), 300, fade(p, 0.02, 0.28))
        mark_alpha = int(255 * fade(p, 0.18, 0.42))
        mark_y = int(760 + 70 * (1 - ease_out(fade(p, 0.18, 0.46))))
        text_layer(image, (540, mark_y), "Khoebo", "Roboto:style=Bold", 126, WHITE + (mark_alpha,))
        rule_width = int(410 * ease_out(fade(p, 0.3, 0.55)))
        draw.rounded_rectangle((540 - rule_width // 2, 845, 540 + rule_width // 2, 855), radius=5, fill=ORANGE + (255,))
        tag_alpha = int(255 * fade(p, 0.35, 0.58))
        tag_y = int(940 + 55 * (1 - ease_out(fade(p, 0.35, 0.62))))
        text_layer(image, (540, tag_y), "Business, simplified.", "Roboto:style=Bold", 54, WHITE + (tag_alpha,))
        line_alpha = int(255 * fade(p, 0.45, 0.7))
        draw.multiline_text((540, 1050), "Know your numbers.\nGrow with confidence.", font=font("Roboto", 34), fill=CREAM + (line_alpha,), anchor="mm", align="center", spacing=16)
        labels = ["SELL", "STOCK", "BOOKS", "INSIGHTS"]
        positions = [70, 305, 540, 775]
        for slot, (label, x) in enumerate(zip(labels, positions)):
            pill_p = ease_out(fade(p, 0.55 + slot * 0.06, 0.72 + slot * 0.06))
            if pill_p <= 0:
                continue
            alpha = int(255 * pill_p)
            shift = int(28 * (1 - pill_p))
            draw.rounded_rectangle((x, 1490 + shift, x + 235, 1560 + shift), radius=35, outline=ORANGE + (alpha,), width=3)
            text_layer(image, (x + 117, 1525 + shift), label, "Roboto:style=Bold", 24, WHITE + (alpha,))
        credit_alpha = int(180 * fade(p, 0.74, 0.9))
        text_layer(image, (540, 1735), "REAL KHOEBO WEB APP  •  DEMO DATA", "Roboto:style=Bold", 22, MUTED + (credit_alpha,))
        light_sweep(image, fade(p, 0.28, 0.9), 52)
        image.convert("RGB").save(os.path.join(out, f"{index:04d}.png"))
    return out


def make_outro_frames():
    out = os.path.join(TEMP, "outro")
    os.makedirs(out, exist_ok=True)
    frames = int(4.2 * FPS)
    for index in range(frames):
        p = index / (frames - 1)
        image = brand_base()
        draw = ImageDraw.Draw(image)
        ring_radius = int(120 + 520 * ease_out(fade(p, 0.0, 0.55)))
        ring_alpha = int(130 * (1 - fade(p, 0.45, 0.9)))
        draw.ellipse((540 - ring_radius, 960 - ring_radius // 2, 540 + ring_radius, 960 + ring_radius // 2), outline=ORANGE + (ring_alpha,), width=4)
        text_layer(image, (540, 170), "READY WHEN YOU ARE", "Roboto:style=Bold", 28, ORANGE + (int(255 * fade(p, 0.08, 0.3)),))
        paste_logo(image, int(300 - 22 * ease_out(fade(p, 0.05, 0.3))), 260, fade(p, 0.05, 0.28))
        mark_alpha = int(255 * fade(p, 0.18, 0.42))
        text_layer(image, (540, int(665 + 55 * (1 - ease_out(fade(p, 0.18, 0.46))))), "Khoebo", "Roboto:style=Bold", 112, WHITE + (mark_alpha,))
        rule_width = int(410 * ease_out(fade(p, 0.28, 0.54)))
        draw.rounded_rectangle((540 - rule_width // 2, 745, 540 + rule_width // 2, 755), radius=5, fill=ORANGE + (255,))
        headline_alpha = int(255 * fade(p, 0.32, 0.6))
        draw.multiline_text((540, int(930 + 48 * (1 - ease_out(fade(p, 0.32, 0.62))))), "Know your numbers.\nGrow with confidence.", font=font("Roboto:style=Bold", 52), fill=WHITE + (headline_alpha,), anchor="mm", align="center", spacing=22)
        feature_alpha = int(255 * fade(p, 0.52, 0.75))
        text_layer(image, (540, 1210), "SELL  •  STOCK  •  BOOKS  •  INSIGHTS", "Roboto:style=Bold", 27, CREAM + (feature_alpha,))
        cta_p = ease_out(fade(p, 0.62, 0.84))
        if cta_p > 0:
            width = int(620 * cta_p)
            draw.rounded_rectangle((540 - width // 2, 1330, 540 + width // 2, 1430), radius=50, fill=ORANGE + (255,))
            text_layer(image, (540, 1380), "Business, simplified.", "Roboto:style=Bold", 38, WHITE + (int(255 * cta_p),))
        text_layer(image, (540, 1770), "Music: Deep House by NastelBom via Pixabay", "Roboto", 18, MUTED + (int(200 * fade(p, 0.75, 0.95)),))
        light_sweep(image, fade(p, 0.35, 0.98), 60)
        image.convert("RGB").save(os.path.join(out, f"{index:04d}.png"))
    return out


def make_caption_frames(name, title, subtitle, duration):
    out = os.path.join(TEMP, f"caption-{name}")
    os.makedirs(out, exist_ok=True)
    frames = min(54, int(duration * FPS))
    for index in range(frames):
        t = index / FPS
        image = Image.new("RGBA", SIZE, (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        enter = ease_out(fade(t, 0.0, 0.32))
        leave = 1 - ease_in_out(fade(t, 1.15, 1.65))
        alpha = int(235 * min(enter, leave))
        if alpha > 0:
            slide = int(70 * (1 - enter) - 36 * (1 - leave))
            x0, y0, x1, y1 = 70 + slide, 1240, 1010 + slide, 1470
            draw.rounded_rectangle((x0, y0, x1, y1), radius=32, fill=INK + (alpha,))
            bar_width = int(300 * ease_out(fade(t, 0.08, 0.45)))
            draw.rounded_rectangle((x0 + 34, y0 + 34, x0 + 34 + bar_width, y0 + 44), radius=5, fill=ORANGE + (alpha,))
            draw.text((x0 + 34, y0 + 105), title, font=font("Roboto:style=Bold", 44), fill=WHITE + (alpha,))
            draw.text((x0 + 34, y0 + 168), subtitle, font=font("Roboto", 28), fill=CREAM + (alpha,))
        image.save(os.path.join(out, f"{index:04d}.png"))
    return out


def make_mask_frames(name, mask_type, point, frames):
    out = os.path.join(TEMP, f"mask-{name}")
    os.makedirs(out, exist_ok=True)
    px, py = point
    for index in range(frames):
        p = ease_in_out(index / (frames - 1))
        mask = Image.new("L", SIZE, 0)
        draw = ImageDraw.Draw(mask)
        if mask_type == "circle":
            radius = int(p * 2400)
            draw.ellipse((px - radius, py - radius, px + radius, py + radius), fill=255)
        elif mask_type == "diamond":
            radius = int(p * 2200)
            draw.polygon([(px, py - radius), (px + radius, py), (px, py + radius), (px - radius, py)], fill=255)
        elif mask_type == "diagonal":
            edge = int(p * (W + H) - H)
            draw.polygon([(0, 0), (edge, 0), (edge + H, H), (0, H)], fill=255)
        elif mask_type == "wipe":
            draw.rectangle((0, 0, int(p * W), H), fill=255)
        elif mask_type == "vertical":
            draw.rectangle((0, 0, W, int(p * H)), fill=255)
        elif mask_type == "panels":
            count = 7
            for i in range(count):
                local = clamp((p - i * 0.055) / (1 - count * 0.055))
                width = int(local * (W / count + 22))
                if width > 0:
                    draw.rectangle((i * (W // count), 0, i * (W // count) + width, H), fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(22))
        mask.save(os.path.join(out, f"{index:04d}.png"))
    return out


def make_light_frames(name, frames):
    out = os.path.join(TEMP, f"light-{name}")
    os.makedirs(out, exist_ok=True)
    for index in range(frames):
        p = index / (frames - 1)
        image = Image.new("RGBA", SIZE, (0, 0, 0, 0))
        layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        center = -700 + p * 2400
        alpha = int(62 * math.sin(math.pi * p))
        draw.polygon([(center - 120, -100), (center + 120, -100), (center + 720, 2020), (center + 480, 2020)], fill=(255, 205, 150, alpha))
        layer = layer.filter(ImageFilter.GaussianBlur(30))
        image.alpha_composite(layer)
        image.save(os.path.join(out, f"{index:04d}.png"))
    return out


def render_graphic_body(frames_dir, duration, index):
    output = os.path.join(TEMP, f"scene_{index:02d}.mp4")
    run([
        "ffmpeg", "-y", "-v", "error", "-framerate", str(FPS), "-start_number", "0",
        "-i", os.path.join(frames_dir, "%04d.png"), "-t", f"{duration:.3f}",
        "-vf", "fps=30,format=yuv420p", "-an", "-c:v", "libx264",
        "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", output
    ])
    return output


def render_raw_body(scene, duration, index):
    output = os.path.join(TEMP, f"scene_{index:02d}.mp4")
    start, source_duration = scene["source"]
    speed = scene["speed"]
    caption = make_caption_frames(scene["name"], scene["caption"][0], scene["caption"][1], duration)
    pan_expr = "417*(0.5-0.5*cos(PI*t/{d}))".format(d=f"{duration:.3f}")
    zoom_x = "40*(0.5-0.5*cos(PI*t/{d}))".format(d=f"{duration:.3f}")
    zoom_y = "71*(0.5+0.5*cos(PI*t/{d}))".format(d=f"{duration:.3f}")
    filter_graph = (
        f"[0:v]setpts={speed:.6f}*PTS,fps=30,"
        f"scale=1080:2338:flags=lanczos,crop=1080:1920:0:{pan_expr},"
        f"scale=1120:1991:flags=lanczos,crop=1080:1920:{zoom_x}:{zoom_y},"
        "format=yuva420p[v];"
        "[1:v]format=yuva420p[c];"
        "[v][c]overlay=0:0:eof_action=pass:format=auto,tpad=stop_mode=clone:stop_duration=0.1,format=yuv420p[out]"
    )
    run([
        "ffmpeg", "-y", "-v", "error", "-ss", f"{start:.3f}", "-i", RAW,
        "-framerate", str(FPS), "-start_number", "0", "-i", os.path.join(caption, "%04d.png"),
        "-filter_complex", filter_graph, "-map", "[out]", "-frames:v", str(int(duration * FPS)),
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", output
    ])
    return output


def render_transition(out_clip, in_clip, name, mask_type, point, index):
    output = os.path.join(TEMP, f"transition_{index:02d}.mp4")
    tail = max(0.0, TRANSITION)
    frames = int(TRANSITION * FPS)
    masks = make_mask_frames(name, mask_type, point, frames)
    light = make_light_frames(name, frames)
    filter_graph = (
        "[0:v]fps=30,format=yuva420p[out];"
        "[1:v]fps=30,format=yuva420p[in];"
        "[2:v]format=gray[mask];"
        "[in][mask]alphamerge[masked];"
        "[out][masked]overlay=0:0:eof_action=pass:format=auto[base];"
        "[3:v]format=yuva420p[l];"
        "[base][l]overlay=0:0:eof_action=pass:format=auto[lit];"
        "[lit]tmix=frames=3:weights='1 2 1',boxblur=1:1,format=yuv420p[result]"
    )
    run([
        "ffmpeg", "-y", "-v", "error", "-ss", f"{tail:.3f}", "-t", f"{TRANSITION:.3f}", "-i", out_clip,
        "-t", f"{TRANSITION:.3f}", "-i", in_clip,
        "-framerate", str(FPS), "-start_number", "0", "-i", os.path.join(masks, "%04d.png"),
        "-framerate", str(FPS), "-start_number", "0", "-i", os.path.join(light, "%04d.png"),
        "-filter_complex", filter_graph, "-map", "[result]", "-t", f"{TRANSITION:.3f}",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", output
    ])
    return output


def compose_silent(bodies, transitions):
    ordered = []
    for index, body in enumerate(bodies):
        ordered.append(body)
        if index < len(transitions):
            ordered.append(transitions[index])
    list_path = os.path.join(TEMP, "concat.txt")
    with open(list_path, "w", encoding="utf-8") as handle:
        for clip in ordered:
            handle.write("file '" + clip.replace("'", "'\\''") + "'\n")
    silent = os.path.join(TEMP, "silent.mp4")
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list_path, "-c", "copy", "-movflags", "+faststart", silent])
    return silent


def add_audio(silent):
    filter_graph = (
        "[0:v]fps=30,format=yuv420p[v];"
        "[1:a]atrim=start=22.0:duration=50.0,asetpts=PTS-STARTPTS,"
        "afade=t=in:st=0:d=0.25,afade=t=out:st=47.0:d=3.0,volume=0.58[a]"
    )
    run([
        "ffmpeg", "-y", "-v", "error", "-i", silent, "-i", MUSIC,
        "-filter_complex", filter_graph, "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
        "-r", "30", "-frames:v", str(int(DURATION * FPS)), "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-t", f"{DURATION:.3f}", "-movflags", "+faststart", OUTPUT
    ])


def export_graphics():
    if os.path.isdir(GRAPHICS):
        shutil.rmtree(GRAPHICS)
    os.makedirs(GRAPHICS)
    shutil.copy(os.path.join(TEMP, "intro", "0090.png"), os.path.join(GRAPHICS, "intro-final.png"))
    shutil.copy(os.path.join(TEMP, "outro", "0080.png"), os.path.join(GRAPHICS, "outro-final.png"))
    for index in range(len(MASK_TYPES)):
        source = os.path.join(TEMP, f"mask-t{index:02d}", "0009.png")
        target = os.path.join(GRAPHICS, f"transition-mask-{index:02d}.png")
        shutil.copy(source, target)


def main():
    if os.path.isdir(TEMP):
        shutil.rmtree(TEMP)
    os.makedirs(GRAPHICS, exist_ok=True)
    os.makedirs(TEMP, exist_ok=True)
    bodies = []
    for index, scene in enumerate(SCENES):
        if scene["kind"] == "graphic":
            frames_dir = make_intro_frames() if scene["name"] == "intro" else make_outro_frames()
            bodies.append(render_graphic_body(frames_dir, scene["duration"], index))
        else:
            bodies.append(render_raw_body(scene, scene["duration"], index))
        print("BODY", scene["name"], scene["duration"])
    transitions = []
    for index, mask_type in enumerate(MASK_TYPES):
        transitions.append(render_transition(
            bodies[index], bodies[index + 1], f"t{index:02d}", mask_type, MASK_POINTS[index], index
        ))
        print("TRANSITION", index, mask_type)
    silent = compose_silent(bodies, transitions)
    add_audio(silent)
    export_graphics()
    print("OUTPUT", OUTPUT)
    print("DURATION", DURATION)


if __name__ == "__main__":
    main()
