/**
 * Sticker and Emoticon Library
 * Organized by categories for easy selection
 */

export interface StickerItem {
  id: string
  emoji: string
  category: string
  name: string
}

export const STICKER_CATEGORIES = {
  celebration: 'Celebration',
  love: 'Love & Romance',
  flowers: 'Flowers & Nature',
  food: 'Food & Drinks',
  travel: 'Travel & Places',
  symbols: 'Symbols & Signs',
  faces: 'Faces & Emotions',
} as const

export const STICKER_LIBRARY: StickerItem[] = [
  // Celebration
  { id: 'celeb-1', emoji: '🎉', category: 'celebration', name: 'Party Popper' },
  { id: 'celeb-2', emoji: '🎊', category: 'celebration', name: 'Confetti' },
  { id: 'celeb-3', emoji: '🎈', category: 'celebration', name: 'Balloon' },
  { id: 'celeb-4', emoji: '🎁', category: 'celebration', name: 'Gift' },
  { id: 'celeb-5', emoji: '🎂', category: 'celebration', name: 'Birthday Cake' },
  { id: 'celeb-6', emoji: '🥳', category: 'celebration', name: 'Party Face' },
  { id: 'celeb-7', emoji: '🎪', category: 'celebration', name: 'Circus' },
  { id: 'celeb-8', emoji: '🎭', category: 'celebration', name: 'Theater' },
  
  // Love & Romance
  { id: 'love-1', emoji: '💖', category: 'love', name: 'Sparkling Heart' },
  { id: 'love-2', emoji: '💝', category: 'love', name: 'Heart with Ribbon' },
  { id: 'love-3', emoji: '💑', category: 'love', name: 'Couple with Heart' },
  { id: 'love-4', emoji: '💒', category: 'love', name: 'Wedding' },
  { id: 'love-5', emoji: '💐', category: 'love', name: 'Bouquet' },
  { id: 'love-6', emoji: '🌹', category: 'love', name: 'Rose' },
  { id: 'love-7', emoji: '💕', category: 'love', name: 'Two Hearts' },
  { id: 'love-8', emoji: '💗', category: 'love', name: 'Growing Heart' },
  { id: 'love-9', emoji: '💓', category: 'love', name: 'Beating Heart' },
  { id: 'love-10', emoji: '💞', category: 'love', name: 'Revolving Hearts' },
  { id: 'love-11', emoji: '🩷', category: 'love', name: 'Pink Heart' },
  { id: 'love-12', emoji: '💍', category: 'love', name: 'Ring' },
  
  // Flowers & Nature
  { id: 'flower-1', emoji: '🌸', category: 'flowers', name: 'Cherry Blossom' },
  { id: 'flower-2', emoji: '🌺', category: 'flowers', name: 'Hibiscus' },
  { id: 'flower-3', emoji: '🌻', category: 'flowers', name: 'Sunflower' },
  { id: 'flower-4', emoji: '🌷', category: 'flowers', name: 'Tulip' },
  { id: 'flower-5', emoji: '🌼', category: 'flowers', name: 'Daisy' },
  { id: 'flower-6', emoji: '🌿', category: 'flowers', name: 'Herb' },
  { id: 'flower-7', emoji: '🍀', category: 'flowers', name: 'Four Leaf Clover' },
  { id: 'flower-8', emoji: '🌾', category: 'flowers', name: 'Sheaf of Rice' },
  
  // Food & Drinks
  { id: 'food-1', emoji: '🥂', category: 'food', name: 'Champagne' },
  { id: 'food-2', emoji: '🍾', category: 'food', name: 'Champagne Bottle' },
  { id: 'food-3', emoji: '🍰', category: 'food', name: 'Shortcake' },
  { id: 'food-4', emoji: '🧁', category: 'food', name: 'Cupcake' },
  { id: 'food-5', emoji: '🍬', category: 'food', name: 'Candy' },
  { id: 'food-6', emoji: '🍭', category: 'food', name: 'Lollipop' },
  { id: 'food-7', emoji: '🍩', category: 'food', name: 'Doughnut' },
  { id: 'food-8', emoji: '☕', category: 'food', name: 'Coffee' },
  
  // Travel & Places
  { id: 'travel-1', emoji: '✈️', category: 'travel', name: 'Airplane' },
  { id: 'travel-2', emoji: '🌍', category: 'travel', name: 'Earth' },
  { id: 'travel-3', emoji: '🗺️', category: 'travel', name: 'Map' },
  { id: 'travel-4', emoji: '🏖️', category: 'travel', name: 'Beach' },
  { id: 'travel-5', emoji: '🏝️', category: 'travel', name: 'Island' },
  { id: 'travel-6', emoji: '🌆', category: 'travel', name: 'Cityscape' },
  
  // Symbols & Signs
  { id: 'symbol-1', emoji: '✨', category: 'symbols', name: 'Sparkles' },
  { id: 'symbol-2', emoji: '⭐', category: 'symbols', name: 'Star' },
  { id: 'symbol-3', emoji: '🌟', category: 'symbols', name: 'Glowing Star' },
  { id: 'symbol-4', emoji: '💫', category: 'symbols', name: 'Dizzy' },
  { id: 'symbol-5', emoji: '🎵', category: 'symbols', name: 'Musical Note' },
  { id: 'symbol-6', emoji: '🎶', category: 'symbols', name: 'Musical Notes' },
  { id: 'symbol-7', emoji: '🎨', category: 'symbols', name: 'Artist Palette' },
  { id: 'symbol-8', emoji: '🎬', category: 'symbols', name: 'Movie Camera' },
  
  // Faces & Emotions
  { id: 'face-1', emoji: '😊', category: 'faces', name: 'Smiling Face' },
  { id: 'face-2', emoji: '😍', category: 'faces', name: 'Heart Eyes' },
  { id: 'face-3', emoji: '🥰', category: 'faces', name: 'Smiling with Hearts' },
  { id: 'face-4', emoji: '😘', category: 'faces', name: 'Kissing Face' },
  { id: 'face-5', emoji: '😄', category: 'faces', name: 'Grinning Face' },
  { id: 'face-6', emoji: '😁', category: 'faces', name: 'Beaming Face' },
  { id: 'face-7', emoji: '🤗', category: 'faces', name: 'Hugging Face' },
  { id: 'face-8', emoji: '🥳', category: 'faces', name: 'Party Face' },
]

export function getStickersByCategory(category: string): StickerItem[] {
  return STICKER_LIBRARY.filter(sticker => sticker.category === category)
}

export function getAllCategories(): string[] {
  return Object.keys(STICKER_CATEGORIES)
}

