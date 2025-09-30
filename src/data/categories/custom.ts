import sorceressImage from "@/assets/sorceress-majestic.jpg";
import { CategoryItem } from "../CategoryList";

export const customCategory: CategoryItem = {
  id: "custom",
  title: "Miscellaneous",
  description: "Everything not already covered: ads, science, professions, design, politics, etc.",
  icon: "✨",
  image: sorceressImage,
  subcategories: [
    {
      id: "advertising",
      title: "Advertising",
      themes: [
        { id: "youtube-pre-roll", title: "YouTube Pre-roll" },
        { id: "billboard", title: "Billboard" },
        { id: "print-ad", title: "Print Ad" },
        { id: "radio-spot", title: "Radio Spot" },
        { id: "tv-commercial", title: "TV Commercial" },
        { id: "social-media-ad", title: "Social Media Ad" },
        { id: "banner-ad", title: "Banner Ad" },
        { id: "product-placement", title: "Product Placement" },
        { id: "guerrilla-marketing", title: "Guerrilla Marketing" },
        { id: "viral-campaign", title: "Viral Campaign" },
        { id: "influencer-marketing", title: "Influencer Marketing" },
        { id: "email-marketing", title: "Email Marketing" },
        { id: "content-marketing", title: "Content Marketing" },
        { id: "search-engine-marketing", title: "Search Engine Marketing" },
        { id: "affiliate-marketing", title: "Affiliate Marketing" },
        { id: "direct-mail", title: "Direct Mail" },
        { id: "telemarketing", title: "Telemarketing" },
        { id: "event-sponsorship", title: "Event Sponsorship" },
        { id: "product-sampling", title: "Product Sampling" },
        { id: "trade-show", title: "Trade Show" }
      ]
    },
    {
      id: "science",
      title: "Science",
      themes: [
        { id: "physics", title: "Physics" },
        { id: "chemistry", title: "Chemistry" },
        { id: "biology", title: "Biology" },
        { id: "astronomy", title: "Astronomy" },
        { id: "geology", title: "Geology" },
        { id: "meteorology", title: "Meteorology" },
        { id: "oceanography", title: "Oceanography" },
        { id: "ecology", title: "Ecology" },
        { id: "genetics", title: "Genetics" },
        { id: "neuroscience", title: "Neuroscience" },
        { id: "psychology", title: "Psychology" },
        { id: "anthropology", title: "Anthropology" },
        { id: "archaeology", title: "Archaeology" },
        { id: "botany", title: "Botany" },
        { id: "zoology", title: "Zoology" },
        { id: "microbiology", title: "Microbiology" },
        { id: "biochemistry", title: "Biochemistry" },
        { id: "quantum-physics", title: "Quantum Physics" },
        { id: "particle-physics", title: "Particle Physics" },
        { id: "astrophysics", title: "Astrophysics" }
      ]
    },
    {
      id: "professions",
      title: "Professions",
      themes: [
        { id: "doctor", title: "Doctor" },
        { id: "nurse", title: "Nurse" },
        { id: "engineer", title: "Engineer" },
        { id: "teacher", title: "Teacher" },
        { id: "lawyer", title: "Lawyer" },
        { id: "chef", title: "Chef" },
        { id: "artist", title: "Artist" },
        { id: "musician", title: "Musician" },
        { id: "writer", title: "Writer" },
        { id: "scientist", title: "Scientist" },
        { id: "pilot", title: "Pilot" },
        { id: "firefighter", title: "Firefighter" },
        { id: "police-officer", title: "Police Officer" },
        { id: "architect", title: "Architect" },
        { id: "dentist", title: "Dentist" },
        { id: "pharmacist", title: "Pharmacist" },
        { id: "veterinarian", title: "Veterinarian" },
        { id: "journalist", title: "Journalist" },
        { id: "photographer", title: "Photographer" },
        { id: "actor", title: "Actor" }
      ]
    },
    {
      id: "design",
      title: "Design",
      themes: [
        { id: "graphic-design", title: "Graphic Design" },
        { id: "web-design", title: "Web Design" },
        { id: "interior-design", title: "Interior Design" },
        { id: "fashion-design", title: "Fashion Design" },
        { id: "industrial-design", title: "Industrial Design" },
        { id: "product-design", title: "Product Design" },
        { id: "ux-ui", title: "UX/UI" },
        { id: "logo-design", title: "Logo Design" },
        { id: "typography", title: "Typography" },
        { id: "animation", title: "Animation" },
        { id: "illustration", title: "Illustration" },
        { id: "photography", title: "Photography" },
        { id: "branding", title: "Branding" },
        { id: "packaging", title: "Packaging" },
        { id: "motion-graphics", title: "Motion Graphics" },
        { id: "3d-modeling", title: "3D Modeling" },
        { id: "video-editing", title: "Video Editing" },
        { id: "game-design", title: "Game Design" },
        { id: "environmental-design", title: "Environmental Design" },
        { id: "exhibition-design", title: "Exhibition Design" }
      ]
    },
    {
      id: "politics",
      title: "Politics",
      themes: [
        { id: "elections", title: "Elections" },
        { id: "campaigns", title: "Campaigns" },
        { id: "debates", title: "Debates" },
        { id: "legislation", title: "Legislation" },
        { id: "government", title: "Government" },
        { id: "diplomacy", title: "Diplomacy" },
        { id: "protests", title: "Protests" },
        { id: "activism", title: "Activism" },
        { id: "political-parties", title: "Political Parties" },
        { id: "international-relations", title: "International Relations" },
        { id: "policy-making", title: "Policy Making" },
        { id: "human-rights", title: "Human Rights" },
        { id: "corruption", title: "Corruption" },
        { id: "scandals", title: "Scandals" },
        { id: "political-figures", title: "Political Figures" },
        { id: "legislative-process", title: "Legislative Process" },
        { id: "judiciary", title: "Judiciary" },
        { id: "elections-2024", title: "Elections 2024" },
        { id: "voting-rights", title: "Voting Rights" },
        { id: "civic-engagement", title: "Civic Engagement" }
      ]
    },
    {
      id: "technology",
      title: "Technology",
      themes: [
        { id: "artificial-intelligence", title: "Artificial Intelligence" },
        { id: "machine-learning", title: "Machine Learning" },
        { id: "blockchain", title: "Blockchain" },
        { id: "cryptocurrency", title: "Cryptocurrency" },
        { id: "virtual-reality", title: "Virtual Reality" },
        { id: "augmented-reality", title: "Augmented Reality" },
        { id: "internet-of-things", title: "Internet of Things" },
        { id: "cybersecurity", title: "Cybersecurity" },
        { id: "cloud-computing", title: "Cloud Computing" },
        { id: "big-data", title: "Big Data" },
        { id: "quantum-computing", title: "Quantum Computing" },
        { id: "robotics", title: "Robotics" },
        { id: "software-development", title: "Software Development" },
        { id: "hardware", title: "Hardware" },
        { id: "gadgets", title: "Gadgets" },
        { id: "mobile-tech", title: "Mobile Tech" },
        { id: "gaming", title: "Gaming" },
        { id: "social-media", title: "Social Media" },
        { id: "e-commerce", title: "E-commerce" },
        { id: "startups", title: "Startups" }
      ]
    },
    {
      id: "miscellaneous",
      title: "Miscellaneous",
      themes: [
        { id: "random", title: "Random" },
        { id: "misc", title: "Misc" },
        { id: "other", title: "Other" },
        { id: "uncategorized", title: "Uncategorized" },
        { id: "general", title: "General" },
        { id: "various", title: "Various" },
        { id: "assorted", title: "Assorted" },
        { id: "mixed", title: "Mixed" },
        { id: "diverse", title: "Diverse" },
        { id: "eclectic", title: "Eclectic" }
      ]
    }
  ]
};
