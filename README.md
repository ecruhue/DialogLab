# VOX LAB

<img src="content/dialoglab-fig.png" alt="VOX LAB teaser figure" width="100%"/>

**VOX LAB** is an authoring environment for configuring and orchestrating multi-agent conversations with animated 3D avatars. Built with React, Vite, and Express, it helps researchers, designers, and developers create, visualize, and evaluate complex agent-based dialog systems.

## Overview

VOX LAB combines a visual authoring interface, avatar-driven playback, and runtime model integrations so teams can rapidly prototype and test conversational experiences.

## Features

- **Visual conversation design**: Build multi-agent conversations with an intuitive node editor.
- **3D avatar integration**: Animate conversations with Ready Player Me avatars and synchronized speech.
- **Multiple LLM providers**: Use either OpenAI or Google Gemini models.
- **Scene management**: Create and organize multiple conversation scenarios.
- **Real-time preview**: Test and iterate quickly while authoring.
- **Verification tooling**: Inspect conversation quality and metrics.
- **Experience mode**: Present completed conversations in a polished viewer.

## Prerequisites

- **Node.js** 18+ (Node 23 recommended for build and deploy scripts)
- **npm** 8+

## Repository Structure

```
VOX-LAB/
├── client/         # React UI (Vite) - Dev server on port 5173
│   ├── src/        # React components and application logic
│   └── public/     # Static assets (avatars, libraries)
└── server/         # Express API server - Listens on port 3010
    ├── providers/  # LLM provider integrations
    └── ...         # Core server logic
```

## Getting Started

### 1. Install Dependencies

```bash
# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

Alternatively, from the repository root:

```bash
npm --prefix client install
npm --prefix server install
```

### 2. Configure Environment Variables

Copy the template and fill in your own values (never commit secrets):

```bash
cp server/.env.example server/.env
```

Then edit `server/.env` and set your provider keys and related config using placeholders only.

Example:

```env
# Core Configuration
NODE_ENV=development

# LLM Providers (configure at least one)
GEMINI_API_KEY=your-gemini-api-key-here
API_KEY_LLM=your-openai-api-key-here

# Defaults (optional)
DEFAULT_LLM_PROVIDER=gemini   # or openai
DEFAULT_OPENAI_MODEL=gpt-4
DEFAULT_GEMINI_MODEL=gemini-2.0-flash

# Text-to-Speech (optional - for avatar speech synthesis)
TTS_API_KEY=your-google-tts-api-key-here
TTS_ENDPOINT=your-tts-endpoint-here
```

You must provide at least one LLM provider API key (OpenAI or Gemini) to run conversations.

### 3. Start the Server

```bash
cd server
node server.js
```

The server starts on `http://localhost:3010`.

### 4. Start the Client

In a separate terminal:

```bash
cd client
npm run dev
```

Open `http://localhost:5173` in your browser.

## Environment Variables (Server)

- `NODE_ENV`: Runtime environment (`development` by default).
- `GEMINI_API_KEY`: Google Gemini API key.
- `API_KEY_LLM`: OpenAI API key.
- `DEFAULT_LLM_PROVIDER`: Default provider (`gemini` or `openai`).
- `DEFAULT_OPENAI_MODEL`: Default OpenAI model.
- `DEFAULT_GEMINI_MODEL`: Default Gemini model.
- `TTS_API_KEY`: Google TTS API key (optional).
- `TTS_ENDPOINT`: Google TTS endpoint (optional).
