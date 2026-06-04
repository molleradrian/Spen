<div align="center">
<img width="1200" height="475" alt="S Pen Draw" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# S Pen Draw

A precision drawing application optimized for S Pen input, featuring cloud storage for your sketches and Gemini AI integration to provide design inspiration and creative remix ideas.

**Live App:** https://ai.studio/apps/d764bcce-cb6e-4b86-8f39-e4d3cabfe96d

## Features

- **S Pen Optimized Drawing Canvas** - Full pressure sensitivity and stylus support for precise, natural drawing
- **Cloud Storage Integration** - Securely save and manage your sketches with Firebase
- **Gemini AI Inspiration** - Get creative suggestions and remix ideas for your artwork
- **Android Development Hub** - Code generation for S Pen SDK implementations and Android Canvas integration
- **Real-time Collaboration** - Share and work on sketches with cloud sync
- **PDF Export** - Save your artwork in professional formats

## Tech Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS
- **Backend:** Express.js, Node.js
- **AI:** Google Gemini API (vision and text generation)
- **Cloud Services:** Firebase (Firestore, Authentication)
- **UI Components:** Lucide Icons, Motion animations
- **Drawing:** Canvas-based with pressure sensitivity support

## Prerequisites

- **Node.js** (v18 or higher)
- **Gemini API Key** (get one at [Google AI Studio](https://ai.google.com))
- **Firebase Project** (optional, for cloud features)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

Then update it with your credentials:

```dotenv
GEMINI_API_KEY=your_gemini_api_key_here
APP_URL=http://localhost:3000
```

### 3. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start the development server with hot reload
- `npm run build` - Build for production (Vite + esbuild)
- `npm start` - Run the production build
- `npm run clean` - Clean build artifacts
- `npm run lint` - Type check with TypeScript

## Project Structure

```
├── src/                  # React components and frontend logic
├── server.ts            # Express backend server
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
├── firebase-*.json      # Firebase configuration files
├── firestore.rules      # Firestore security rules
├── metadata.json        # App metadata
└── package.json         # Dependencies and scripts
```

## API Endpoints

### POST `/api/gemini/inspire`
Get creative suggestions for your drawing.

**Request:**
```json
{
  "imageData": "data:image/png;base64,...",
  "prompt": "Optional custom prompt"
}
```

### POST `/api/gemini/android-developer`
Generate Android code or get S Pen development guidance.

**Request:**
```json
{
  "mode": "code-gen" | "chat",
  "language": "compose" | "view",
  "prompt": "Your question or requirements",
  "imageData": "data:image/png;base64,...",
  "layersSummary": "Drawing structure summary"
}
```

## Security

- API keys are managed through environment variables
- Firebase Firestore security rules are configured for user-based access
- See `security_spec.md` for detailed security specifications

## Deployment

The app is built for deployment on Google Cloud Run:

```bash
npm run build
npm start
```

Production builds include both the optimized frontend and bundled backend server.

## Contributing

This is a personal project template from Google AI Studio. Feel free to fork and customize for your needs.

## License

See LICENSE file for details.

## Support

For issues or questions:
- Check the [Google Gemini API Documentation](https://ai.google.dev/docs)
- Review the [Firebase Documentation](https://firebase.google.com/docs)
- Visit the [AI Studio](https://ai.studio) community
