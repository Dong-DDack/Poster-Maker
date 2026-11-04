# Poster Maker

A personal AI poster maker inspired by text-to-poster studios. Paste source text, choose an art direction and aspect ratio, review the copy plan, and create an editable composition.

## Run locally

1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env` and add your OpenAI API key to `OPENAI_API_KEY`.
3. Keep `.env` private; it is excluded by `.gitignore`.
4. Run `npm start` from this folder and open the localhost URL printed in the terminal.

## Prototype features

- Freeform source text to structured headline, supporting copy, and details
- AI recommendation from 20 international design styles
- Six poster ratios and Korean, English, or Japanese copy
- Optional reference image for the focal subject
- Separate image generation for the background and optional transparent main subject
- Copy is exported as individual SVG text objects; background and focal subject are separate SVG image objects
- PNG export flattens the composition for sharing

The editable SVG is intended for Illustrator object-level editing. The generated scene inside the background image is still one raster image; the optional focal subject is a separate image object. Individual items within a single generated image are not automatically split apart. Photoshop PSD export is not implemented yet.

Planning, background rendering, and subject rendering are separate API requests and incur separate charges. SVG text may use substituted fonts if the original font is not installed.

This is a local prototype. Before public deployment, add authentication, request and spending limits, image storage, privacy disclosures, and monitoring.
