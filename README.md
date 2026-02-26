# 🎵 Ynme - Spotify-Level Infinite Music Player

Ynme is a powerful, full-stack MERN application that provides a Spotify-like infinite listening experience. It integrates YouTube, Spotify, and AI-powered recommendations to ensure your music never stops playing. It also features remote device synchronization and live listening rooms!

## ✨ Features
* **Infinite Autoplay**: When your queue ends, Ynme seamlessly fetches similar tracks using Spotify's recommendation API and the latest Llama 3.1 AI model as a fallback.
* **Universal Search**: Search for songs, artists, or videos across both YouTube and Spotify simultaneously.
* **Remote Device Control**: Connect your smartphone and your desktop, and use one to control the music playing on the other.
* **Live Listening Rooms**: Create real-time rooms where multiple users can listen to the same synchronized queue and chat.
* **Playlist Management**: Save your favorite tracks into custom playlists and even upload local audio files.

## 🚀 Tech Stack
* **Frontend**: React 18, Vite, TailwindCSS, Lucide Icons
* **Backend**: Node.js, Express, Socket.io, Mongoose
* **Database**: MongoDB Atlas
* **APIs**: YouTube Data API, Spotify Web API, Groq (Llama 3.1)

## 💻 Local Development

1. **Clone the repository**
```bash
git clone https://github.com/Sagararora90/ynme.git
cd ynme
```

2. **Setup the Backend**
```bash
cd ynme-server
npm install
```
* Create a `.env` file in the `ynme-server` directory with the following variables:
  * `PORT=5001`
  * `MONGO_URI=`
  * `JWT_SECRET=`
  * `YOUTUBE_API_KEY=`
  * `SPOTIFY_CLIENT_ID=`
  * `SPOTIFY_CLIENT_SECRET=`
  * `GROQ_API_KEY=`

* Start the backend development server:
```bash
npm run dev
```

3. **Setup the Frontend**
```bash
cd ../ynme-web
npm install
npm run dev
```

## 🌐 Deployment
The repository is structured to be easily deployed on standard free-tier hosting platforms.

* **Backend**: Deploy the `ynme-server` folder to **Render.com** as a Web Service to fully support WebSockets (Socket.io).
* **Frontend**: Deploy the `ynme-web` folder to **Vercel** or **Netlify**. Ensure you set the `VITE_API_URL` environment variable to your deployed backend URL.
