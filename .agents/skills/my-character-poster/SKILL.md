---
name: my-character-poster
description: Create Korean event and campaign posters centered on a recurring mascot or character, with editable text, reusable visual preferences, and image-generation references. Use when creating or revising a poster, flyer, or social graphic.
---

# My Character Poster

Turn a short brief into a Korean poster concept and editable poster file. Keep character art and poster typography as separate layers: generate or source the artwork, then place all important copy as real HTML/CSS text.

## Before creating

1. Read the project `EXTEND.md` for the user's saved design defaults. Treat unset fields as undecided; do not invent personal preferences.
2. Read [character-profile.md](references/character-profile.md) when the user has a recurring character or provides a character reference. Use the provided image as the identity reference in every generation/edit request when the image tool accepts references. Preserve the character's silhouette, face, colors, and signature details across variations. Never claim exact identity consistency if the renderer cannot guarantee it.
3. Extract the exact Korean copy and its priority: title, subtitle, date/time, venue, organizer, CTA, URL/contact, and optional details. Preserve names, dates, numerals, URLs, and user-supplied copy verbatim. Mark missing facts as omitted or ask only when they are essential to the requested poster.
4. Select a visual style from [style-catalog.md](references/style-catalog.md), using a saved preference if set. Otherwise choose one fitting style and briefly say why; offer alternatives only when the user is exploring.

## Create the poster

1. Make a compact concept: audience, mood, main character action/pose, outfit, setting, palette, aspect ratio, and information hierarchy.
2. Generate only the background/illustration with the available image-generation tool. Keep requested headline, dates, venue, URL, logos, and other exact copy out of generated pixels. For an attached character reference, ask for a new pose/outfit/scene while preserving the defined identity. Do not train or fine-tune on supplied artwork unless the user explicitly requests it and confirms they have rights for that use.
3. Compose the artwork and editable typography using the starter at [poster-template.html](assets/poster-template.html). Adapt its layout and palette to the brief. Make the poster title the strongest text, followed by date/venue and then supporting details. Keep URLs and QR destinations exact; do not invent a CTA, sponsor, date, address, or event detail.
4. Save a reviewable package under `poster/<short-kebab-topic>/`:

   ```text
   poster/<topic>/
   ├── brief.md
   ├── character.md
   ├── prompt.md
   ├── artwork.png
   ├── poster.html
   └── poster.png (when a renderer/exporter is available)
   ```

5. Report the chosen style, aspect ratio, any omitted/missing fields, output paths, and whether text remains editable. If image generation or export is unavailable, still produce the concept, prompt, and editable HTML, and clearly state what could not be rendered.

## Keep personal preferences reusable

When the user explicitly says to remember a design preference, update `EXTEND.md` with only that preference (palette, ratio, style, typography mood, or layout). Do not save temporary instructions or treat a one-off request as a permanent default. A user may change or remove these values at any time.

## Important quality rules

- Use the provided character reference and written character profile together; the written description is the stable identity checklist.
- Keep the character readable at the selected format and leave clear space for text.
- Use real HTML text for Korean copy so it stays editable and avoids image-model spelling errors.
- Choose fonts available in the environment or load a licensed web font; keep a sensible Korean sans-serif fallback.
- For dense information, simplify decoration before shrinking required text.
- Never reuse a supplied reference image as a project asset unless the user asks and has the right to use it. A reference guides generation; it does not grant reuse rights.
