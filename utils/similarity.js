/**
 * Utility functions for similarity checking
 */

import { fetchAndCheckSimilarity } from './api.js';

// Main similarity check function
export async function similarityCheck(text1, text2) {
  try {
    const results = await fetchAndCheckSimilarity(text1);
    
    // Find the highest similarity score
    let maxSimilarity = 0;
    for (const result of results) {
      if (result.similarity > maxSimilarity) {
        maxSimilarity = result.similarity;
      }
    }
    
    return maxSimilarity;
  } catch (error) {
    console.error('Error in similarity check:', error);
    return 0;
  }
}