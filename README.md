## DialogLab

<img src="content/dialoglab-fig.png" alt="DialogLab teaser figure" width="100%"/>

[Paper](https://dl.acm.org/doi/10.1145/3746059.3747696) | [30s Preview](https://www.youtube.com/watch?v=AdvYhP8A51M) | [Video Figure](https://www.youtube.com/watch?v=U2Ag_Ktobzw) | 
[Web Demo](https://chatlab.3dvar.com/)

DialogLab is a tool for configuring and running multi-agent conversations, with a React + Vite client and an Express server.

### Prerequisites
- Node.js 18+ (client build and deploy scripts recommend Node 23)
- npm 8+

### Repository layout
- `client/`: React UI (Vite). Dev server on port 5173. Proxies API to the server.
- `server/`: Express API/Web server. Listens on port 3010.

### Quick start (development)
1) Install dependencies
- `cd client && npm install`
- `cd server && npm install`

2) Configure environment (server/.env)
Create a `.env` file in `server/` with the keys you intend to use. Example:
```
# Core
NODE_ENV=development

# LLM providers (choose one or both)
GEMINI_API_KEY=your-gemini-api-key
API_KEY_LLM=your-openai-api-key

# Defaults (optional)
DEFAULT_LLM_PROVIDER=gemini   # or openai
DEFAULT_OPENAI_MODEL=gpt-4
DEFAULT_GEMINI_MODEL=gemini-2.0-flash

# Text-to-Speech (optional)
TTS_API_KEY=your-google-tts-api-key
TTS_ENDPOINT=https://eu-texttospeech.googleapis.com/v1beta1/text:synthesize
```

3) Run the server
```
cd server
node server.js
```
The server will start at `http://localhost:3010`.

4) Run the client
```
cd client
npm run dev
```
Open the client at `http://localhost:5173`.



### Third-Party Components

#### TalkingHead (MIT License)
Portions of this project’s code are adapted from the open-source project [TalkingHead](https://github.com/met4citizen/TalkingHead),  
© 2024 Mika Suominen (met4citizen), and are used under the MIT License.  
This applies to:  
- `client/public/libs/talkinghead.mjs` 

---

#### Three.js (MIT License)
This project uses [Three.js](https://threejs.org/) and its example modules,  
© 2010–present Three.js authors, licensed under the MIT License.  
See [https://github.com/mrdoob/three.js/blob/dev/LICENSE](https://github.com/mrdoob/three.js/blob/dev/LICENSE) for details.

---

#### Ready Player Me Avatars (Custom License)
Example avatar files (`client/public/assets/*.glb`) were created using [Ready Player Me](https://readyplayer.me/)  
and are subject to [Ready Player Me’s Terms of Use](https://readyplayer.me/terms-of-use).  
These assets are provided for demonstration purposes only and are **not covered** by this project’s open-source license.


### Citation
If you use DialogLab in your research, please cite:

```bibtex
@inproceedings{dialoglab2025,
author = {Hu, Erzhen and Chen, Yanhe and Li, Mingyi and Phadnis, Vrushank and Xu, Pingmei and Qian, Xun and Olwal, Alex and Kim, David and Heo, Seongkook and Du, Ruofei},
  title     = {DialogLab: Configuring and Orchestrating Multi-Agent Conversations},
  booktitle = {Proceedings of the 38th Annual ACM Symposium on User Interface Software and Technology (UIST '25)},
  year      = {2025},
  publisher = {Association for Computing Machinery},
  address   = {New York, NY, USA},
  doi       = {10.1145/3746059.3747696}
}
```
