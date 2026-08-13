---
name: higgsfield-studio
description: "Generate any image or video with Higgsfield and save the finished file to a folder on the user's computer. Use this skill whenever the user wants to create something with Higgsfield but has not specified every detail, for example \"generate something with Higgsfield\", \"make me an image\", \"create a video\", \"use Soul Cinema\", \"I want a Kling clip\", \"generate a product shot\", or any open request to produce a still or a clip with Higgsfield. The skill always asks four questions first, in order: (1) image or video, (2) which model, (3) what format, (4) what resolution, then generates, downloads and renames the file. For clean studio portrait batches specifically (casting boards, model reference sheets, avatar libraries with no text or watermark), use the dedicated higgsfield-soul-portraits skill instead. Русские триггеры: сгенерируй картинку, сделай видео, сгенерируй через Higgsfield, нужен ролик, сделай кадр, создай изображение, сгенерируй продуктовый кадр, хочу клип. Не для ролика на первый экран сайта клиента — hero-video (там промпт собирается инструментом и действует запрет на текст, вывески и лица по §12 CLAUDE.md)."
---

# Higgsfield Studio

This skill is the general entry point for creating anything with Higgsfield: images or videos,
any model, any format, any resolution. It collects the four decisions that change every
generation, runs the job, downloads the finished file, and names it the way the client wants.

The aim is that someone can say "generate something with Higgsfield" with no other detail and end
up with a correctly formatted, correctly named file in the right folder, without guessing.

## Before anything: the Higgsfield connection

Generation runs through the Higgsfield MCP connector (server URL `https://mcp.higgsfield.ai/mcp`).
If no Higgsfield tool is available in the session, do not try to fake it with a browser or a
direct API call. Tell the user the Higgsfield connector is not connected and point them to
Settings to add it, then stop until it is connected.

Models, formats and resolutions on Higgsfield change often. The lists below are current guidance,
not a hard contract. Always defer to the options the connected Higgsfield tool actually reports.
If the tool exposes a model, format or resolution that is not listed here, it is still valid. If
the user asks for something the chosen model does not support, say so and offer the closest
supported option.

## The intake: ask these four, in this order

This is the core of the skill. Ask in this exact order and do not skip ahead. The reason for the
order is that each answer narrows the next: the medium decides which models are available, the
model decides which formats and resolutions exist.

Two rules govern how much to ask:

- Skip anything the user already gave. If the request already names the medium, model, format and
  resolution (for example "make a 4K Soul 2.0 image, 9:16"), do not re-ask any of it. Confirm
  back what you understood and go straight to generating.
- Ask only for what is missing, still in order. If they said "make a video" but nothing else, the
  medium is answered, so start at question 2.

Use a single clear question per step. Offer the common options, and make it easy to pick.

### 1. Image or video

Confirm the medium first, because it splits the whole model list.

- Image: stills, product shots, portraits, posters, concept art.
- Video: clips, animations, image-to-video, ads.

### 2. Which model

Present the models that fit the chosen medium. Higgsfield carries 30+ models, so do not dump the
whole catalogue. Offer the strong current defaults and let the user ask for the full list if they
want it.

Image models (examples, defer to live options):

- Soul 2.0: high-aesthetic, fashion-aware realistic stills. A safe default for most image jobs.
- Soul Cinema: cinematic stills with film grain, texture and mood.
- Nano Banana Pro: fast, flexible general image model, strong for product and edits.
- Seedream 5, Flux 2, GPT Image 2: alternatives when the user names them or wants a different look.

Video models (examples, defer to live options):

- Kling 3.0: strong general text-to-video and image-to-video.
- Seedance 2.0: fast, expressive motion.
- Veo 3.1: high-fidelity cinematic video.
- Sora 2, WAN 2.6: alternatives when named or when the look calls for them.

If the user has no preference, recommend one (Soul 2.0 for images, Kling 3.0 for video) and say
why in a line, then let them override.

### 3. What format

Format means aspect ratio (and orientation). Offer the common ones and accept anything the model
supports:

- 9:16 vertical (Reels, TikTok, Stories)
- 1:1 square (feed posts)
- 16:9 landscape (YouTube, wide hero shots)
- 4:5, 4:3, 3:4, 3:2, 2:3 when asked

Confirm orientation if the request is ambiguous (for example "portrait" can mean 9:16 or 4:5).

### 4. What resolution

Offer the resolutions the chosen model supports. This varies by model, so present the model's real
options rather than a fixed list.

- Images: typically up to 4K. Common steps are 1.5k, 2k and 4k.
- Video: resolution plus duration. Higgsfield video runs up to about 15 seconds, so for video also
  confirm clip length (for example 5s, 6s, 10s) alongside resolution.

Higher resolution and longer video cost more credits and take longer. If the user is generating a
large batch, mention that once so there are no surprises.

After all four are settled, read the choices back in one short line ("Soul 2.0 image, 9:16, 4K,
named acme-launch") and proceed.

## Generation workflow

### Confirm the save folder

Always confirm where to save before generating, because it changes between projects. If no folder
is connected yet, request folder access first. Once confirmed, reuse that folder for the rest of
the run, and create it if it does not exist.

### Submit the job

Call the Higgsfield generation tool with the four chosen parameters (medium, model, format,
resolution, plus duration for video) and the user's prompt, unchanged unless it needs a cleanup
flagged to the user first. For a batch, submit the prompts together so they run in parallel; for
very large batches, submit in groups of about 10 to 15 to stay responsive.

Each call returns a job with an `id` and a `status`. Keep every job id paired with the prompt it
came from so files can be named correctly later.

### Wait for completion

Generation is asynchronous. Poll each job until `status` is `completed`. Images usually finish in
seconds; video takes longer depending on model and length. Do not poll in a tight loop. Wait a
sensible interval between checks (a short sleep), and re-check only the jobs still running.

When a job completes, the response includes a result URL. For images, use the full-resolution
asset (the `rawUrl` style field), never the small preview. For video, use the full video file URL.

### Download the file

Download each completed result into the confirmed folder. A reliable pattern in the shell:

```bash
cd "<target-folder>"
curl -sL "<resultUrl>" -o "<chosen-name>.<ext>"
```

Use `.png` (or `.jpg`) for images and `.mp4` for video, matching what the result URL returns.

After downloading, verify each file is real and complete with a quick `file <name>` check. A
truncated or failed download will not report as a valid PNG, JPEG or MP4, so this catches problems
before you present anything.

### Rename to what the client wants

Naming default: build the name automatically from the prompt plus the key settings, so a set stays
organised and sortable. Pattern:

```
<short-slug>-<model>-<format>-<resolution>-01.<ext>
<short-slug>-<model>-<format>-<resolution>-02.<ext>
```

where `<short-slug>` is two or three words pulled from the prompt (for example `blonde-model`,
`acme-buds`, `city-night`). Zero-pad the number so large sets sort correctly (01, 02, ... 25).

If the user gave a custom base name, use theirs instead and number from there (for example
`acme-launch-01`, `acme-launch-02`). If they have not said and the batch is more than a couple of
files, ask once whether they want a custom base name before downloading, then apply it to the whole
set. For a single file, auto-naming is fine without asking.

### Present the results

Show the saved files to the user with file cards so they can open them, then give a one or two line
summary: how many files, the folder, and the format and resolution. Keep it brief, the user can see
the results themselves.

## Quick reference

| Decision      | Ask order | Default if no preference        | Notes                                    |
| ------------- | --------- | ------------------------------- | ---------------------------------------- |
| Medium        | 1         | ask, do not assume              | image or video, splits the model list    |
| Model         | 2         | Soul 2.0 (image), Kling 3.0 (video) | offer a few, defer to live options   |
| Format        | 3         | confirm, do not assume          | 9:16, 1:1, 16:9, plus others on request  |
| Resolution    | 4         | model's top sensible option     | up to 4K image; video adds duration      |
| Result asset  | -         | full-res / full video           | never the small preview                  |
| Naming        | -         | auto from prompt + settings     | custom base name on request              |

## Summary

This skill turns any vague Higgsfield request into a finished, correctly named file by always
settling four things first, in order: image or video, which model, what format, what resolution.
It only asks for what the user has not already given, then generates, downloads the full-resolution
result, verifies it, and names it the client's way. 