# Plate Calorie Checker

Take a photo of your plate. The app checks the photo, sends it to an AI image model on Groq,
and shows each food with its portion, calories, and protein/carbs/fat.

## What's inside

| File | What it does |
|---|---|
| `index.html` | The page: choose a photo, see a photo check (too dark? blurry?), press **Count calories**, see the results. Change **Amount** (½×, 2×, None…) if you ate more or less, and the totals update. |
| `api/calories.js` | Serverless function: sends the photo to Groq's image model (`qwen/qwen3.8-27b`), asks for JSON, and tidies it for the page |
| `.env.local.example` | Template for your own Groq API key |

Flow: **Photo → your page → your API (`api/calories.js`) → Groq → back to your page.**
The key stays in `.env.local` (or Vercel's Environment Variables once deployed), and only `api/calories.js` reads it.
The page never sees it. Never paste the key into any code file.

The photo check runs in the browser with no key: it measures the photo's average brightness and its
sharpness (how strong the edges are) and warns you before you spend a scan on a bad photo.

## Deploy with GitHub + Vercel

1. **Put the code on GitHub:** create a new repository at https://github.com/new, then upload the files in this folder.
   Do **not** upload `.env.local` — it holds your secret key.
2. **Import it on Vercel:** go to https://vercel.com/new, pick the repository, and leave the settings as they are.
3. **Add your key:** before pressing **Deploy**, open **Environment Variables** and add `GROQ_API_KEY` with your Groq key.
   (Forgot? Add it later in Settings → Environment Variables, then redeploy.)
4. **Deploy.** Every time you change a file on GitHub, Vercel updates the site by itself.

## Run it on your laptop (optional)

1. Get a free Groq key at https://console.groq.com/keys.
2. Copy `.env.local.example` to a new file named `.env.local` and paste your key after `GROQ_API_KEY=`.
3. Install the Vercel CLI once: `npm install -g vercel`
4. In this folder, run `vercel dev`, then open http://localhost:3000

## If something goes wrong

| You see | What it means |
|---|---|
| `GROQ_API_KEY is missing` | Locally: `.env.local` is missing or empty. On Vercel: add the key in Settings → Environment Variables and redeploy. |
| `Invalid API Key` | The key was copied wrongly. Copy it again from console.groq.com/keys. |
| `Free limit reached — wait a minute` | Groq's free plan allows only a few photos per minute. Wait and try again. |
| `model ... does not exist` or `decommissioned` | Groq changed its image model. Check console.groq.com/docs/vision and update `MODEL` at the top of `api/calories.js`. |
| `The model's answer was not in the expected format` | The model replied with something other than JSON. Press the button again. |
| `Could not reach the server: Failed to fetch` | `vercel dev` is not running, or you opened the HTML file directly instead of http://localhost:3000. |
