<div align="center">

# Poster Maker

### Turn an idea into a poster.

AI-assisted poster creation with an editable SVG export.

[**Open the live demo →**](https://poster-maker-5mv7.onrender.com/)

<br>

![Node.js](https://img.shields.io/badge/Node.js-20%2B-43853d?style=flat-square&logo=node.js&logoColor=white)
![OpenAI API](https://img.shields.io/badge/AI-OpenAI_API-111111?style=flat-square&logo=openai&logoColor=white)
![Render](https://img.shields.io/badge/Deploy-Render-5b36d5?style=flat-square&logo=render&logoColor=white)

</div>

---

Poster Maker is a personal project for turning event notes, announcements, and rough ideas into designed posters. Describe what you need, choose a visual direction, and let AI prepare the copy and artwork layers.

## How it works

1. Paste your event details or poster idea.
2. Choose a style, aspect ratio, and copy language—or ask AI to recommend a style.
3. Review and edit the headline, supporting copy, and details.
4. Generate the background and, optionally, a separate transparent focal subject.
5. Download a flattened PNG or an editable SVG.

## Features

- **20 visual directions** including Swiss Editorial, Bauhaus Modular, Risograph, Y2K Digital, and Minimalist
- **Six aspect ratios** for portrait, square, and landscape layouts
- **Korean, English, and Japanese** poster copy
- **Separate SVG objects** for the background image, optional focal subject, and text
- **Optional reference image** for the focal subject (PNG, JPG, or WEBP)
- **Friendly exhausted-credit message** when the API balance or spending limit prevents more generations

## Editing the export

Open the SVG in **Adobe Illustrator** or **Inkscape** to select and edit the main objects and text individually. The generated background is one raster image, so objects inside that background are not independently movable. An optional focal subject is a separate image object. PNG exports are flattened.

Photoshop PSD export is not supported.

## Run locally

**Requirements:** Node.js 20 or later and an OpenAI API key with API billing enabled.

```bash
git clone https://github.com/Dong-DDack/Poster-Maker.git
cd Poster-Maker
```

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your_api_key_here
```

Then start the server:

```bash
npm install
npm start
```

Open the local URL printed in the terminal. On Windows PowerShell, you can run the start command as `npm.cmd start` if `npm start` is not recognized.

## Deploy on Render

Create a **Web Service** connected to this GitHub repository and use:

| Setting | Value |
| --- | --- |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Environment Variable | `OPENAI_API_KEY` = your API key |

Keep the key in Render's Environment settings. Do not commit `.env` or place the key in browser code. The public demo sends requests through the server, so API usage consumes the owner's OpenAI balance. Image generation can make multiple billable requests per poster; check OpenAI's Usage dashboard and Render's Billing page regularly. Render's free services can sleep after inactivity, so the first visit after a quiet period may take longer.

## Notes

- Planning, background generation, and optional subject generation are separate API requests and may each incur a charge.
- Review names, dates, locations, prices, and links before downloading. AI-generated copy and images may need manual corrections.
- The public demo is intended for experimentation, not production use. It currently has no sign-in or per-user quota system.
- Only upload reference images you have permission to use.

## License

This repository is a personal prototype. No license has been added yet; contact the author before reusing or redistributing the project.
