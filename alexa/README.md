# DisplayProject Alexa Skill

This folder contains a minimal Alexa Custom Skill that controls the display via the backend API.

## Setup

1. Create an Alexa Custom Skill in the [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask).
2. Import `interactionModel.json` as the interaction model.
3. Deploy `lambda/index.js` as the skill endpoint (AWS Lambda).
4. Set Lambda environment variables:
   - `DISPLAY_API_URL` — e.g. `https://your-server.example.com`
   - `CONTROL_API_KEY` — must match `CONTROL_API_KEY` in `backend/.env`

## Supported utterances

- "Alexa, open display project"
- "Alexa, turn on the display"
- "Alexa, turn off the display"
- "Alexa, sleep the display"
- "Alexa, next widget on the display"

## Local testing

Expose your backend with ngrok, then point `DISPLAY_API_URL` at the public HTTPS URL.
