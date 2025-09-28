import paparazziImage from "@/assets/paparazzi-scene.jpg";
import { CategoryItem } from "../CategoryList";

export const popCultureCategory: CategoryItem = {
  id: "pop-culture",
  title: "Pop Culture",
  description: "Movies, music, and trending topics",
  icon: "🎬",
  image: paparazziImage,
  subcategories: [
    { id: "movies", title: "Movies" },
    { id: "tv-shows", title: "TV Shows" },
    { id: "music", title: "Music" },
    { id: "celebrities", title: "Celebrities" },
    { id: "fashion", title: "Fashion" },
    { id: "memes", title: "Memes" },
    { id: "video-games", title: "Video Games" },
    { id: "sports-icons", title: "Sports Icons" },
    { id: "streaming-services", title: "Streaming (Netflix, Hulu, Prime, Disney+)" },
    { id: "tiktok-trends", title: "TikTok Trends" },
    { id: "youtube-culture", title: "YouTube Culture" },
    { id: "comics", title: "Comics (Marvel, DC, manga)" },
    { id: "anime", title: "Anime" },
    { id: "awards-shows", title: "Awards Shows (Oscars, Grammys, Emmys)" },
    { id: "internet-challenges", title: "Internet Challenges" },
    { id: "podcasts", title: "Podcasts" },
    { id: "celebrity-gossip", title: "Celebrity Gossip" },
    { id: "influencers", title: "Influencers" },
    { id: "fan-fandoms", title: "Fan Fandoms (Harry Potter, Star Wars, BTS, etc.)" },
    { id: "reality-tv", title: "Reality TV" },
    { id: "social-media-drama", title: "Social Media Drama" },
    { id: "stand-up-comedy", title: "Stand-up Comedy" },
    { id: "dance-trends", title: "Dance Trends" },
    { id: "technology-gadgets", title: "Technology/Gadgets (Apple drops, AI hype, etc.)" },
    { id: "streaming-music", title: "Streaming Music (Spotify, SoundCloud, Apple Music)" },
    { id: "fictional-characters", title: "Fictional Characters" }
  ]
};