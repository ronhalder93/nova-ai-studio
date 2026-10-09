NOVA AI STUDIO — NEW INDEPENDENT PROJECT

Project name: nova-ai-studio
App title: Nova AI Studio

Files:
- index.html: responsive mobile-friendly AI chat interface with chat history, voice input/read-aloud, image mode, and video mode.
- server.js: Express backend with /api/chat, /api/image, and /api/video routes.
- package.json: Node.js setup.

IMPORTANT: This is the source-code package. It has NOT been uploaded to GitHub or deployed to Render yet. It does not modify your existing Nova AI services.

DEPLOY AS A NEW PROJECT
1. Open https://github.com/new while signed in to GitHub.
2. Repository name: nova-ai-studio. Choose Public or Private, then create it.
3. Upload the four files from this folder (index.html, server.js, package.json, README.txt) to the repository root and commit.
4. Open https://dashboard.render.com/web/new and connect the NEW nova-ai-studio repository.
5. Set:
   - Name: nova-ai-studio
   - Runtime: Node
   - Build command: npm install
   - Start command: npm start
   - Plan: Free (if available)
6. Deploy the service.
7. In Render Environment, add valid provider keys as environment variables:
   - POLLINATIONS_API_KEY = your provider key (chat/image support depends on provider availability and terms)
   - FAL_KEY = your fal.ai API key (video generation)
   Optional: CHAT_MODEL and VIDEO_MODEL.

SECURITY
- Never paste API keys into index.html or commit them to GitHub.
- Keep keys only in Render Environment settings.
- Image/video generation requires valid provider credentials and supported model access.
- The file picker currently previews the selected filename in the UI; it does not upload file contents to the AI provider.
