// Visual generation rules and subcategory contexts
export const visual_rules = `Generate 4 concise scene descriptions for a meme image, each 7–12 words. Focus on visual elements that enhance the text content. Avoid text or word overlays in the scene descriptions.

GUIDELINES:
- Focus on environmental context, character poses, lighting, and mood
- Ensure scenes support the text content thematically  
- Include relevant props, backgrounds, and atmospheric details
- Maintain visual consistency with the specified style and tone
- Each description should be complete and self-contained
- Prioritize clarity and visual impact over complexity`;

export const subcategory_contexts: Record<string, string> = {
  "birthday": "party decorations, balloons, cake, festive atmosphere, celebration elements",
  "coffee": "coffee shop, cafe setting, coffee cups, steam, cozy atmosphere, morning light",
  "work": "office environment, desk setup, computer, workplace elements, professional setting",
  "relationship": "intimate settings, couple interactions, romantic atmosphere, emotional expressions",
  "food": "kitchen, dining, restaurant, cooking utensils, food preparation, culinary elements",
  "travel": "landscapes, transportation, luggage, destinations, adventure elements, scenic views",
  "fitness": "gym equipment, outdoor activities, sports gear, active poses, health elements",
  "technology": "modern devices, screens, digital elements, futuristic settings, tech accessories",
  "nature": "outdoor scenes, natural lighting, wildlife, landscapes, organic textures, seasons",
  "default": "general scene, background elements, props, atmospheric details, contextual elements"
};
