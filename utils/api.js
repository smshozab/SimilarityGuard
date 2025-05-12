/**
 * API utilities for similarity detection using AI
 */

import { createClient } from '@supabase/supabase-js';
import { encode } from 'gpt-tokenizer';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Get embeddings for text using Supabase's built-in AI features
async function getEmbeddings(text) {
  try {
    const model = new Supabase.ai.Session('gte-small');
    const embeddings = await model.run(text, { mean_pool: true, normalize: true });
    return embeddings;
  } catch (error) {
    console.error('Error getting embeddings:', error);
    throw error;
  }
}

// Calculate cosine similarity between two embedding vectors
function cosineSimilarity(vector1, vector2) {
  if (!vector1 || !vector2 || vector1.length !== vector2.length) return 0;
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    magnitude1 += vector1[i] * vector1[i];
    magnitude2 += vector2[i] * vector2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  return dotProduct / (magnitude1 * magnitude2);
}

// Check if text has characteristics of AI-generated content
async function checkAICharacteristics(text) {
  // Analyze text patterns common in AI-generated content
  const patterns = {
    repetitiveStructures: /(similarly|likewise|in addition|furthermore|moreover|consequently)/gi,
    formalTransitions: /(therefore|thus|hence|accordingly|as a result)/gi,
    genericPhrasing: /(it is important to note|it should be mentioned|it is worth noting)/gi,
    perfectGrammar: /[^.!?]+[.!?]+/g
  };
  
  let score = 0;
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  
  // Check for AI patterns
  score += (text.match(patterns.repetitiveStructures) || []).length * 0.1;
  score += (text.match(patterns.formalTransitions) || []).length * 0.1;
  score += (text.match(patterns.genericPhrasing) || []).length * 0.15;
  
  // Check for unusually perfect grammar and structure
  if (sentences.length > 0) {
    const avgSentenceLength = text.length / sentences.length;
    if (avgSentenceLength > 10 && avgSentenceLength < 25) score += 0.2;
  }
  
  // Check token distribution
  const tokens = encode(text);
  const uniqueTokens = new Set(tokens).size;
  const tokenRatio = uniqueTokens / tokens.length;
  if (tokenRatio > 0.6 && tokenRatio < 0.8) score += 0.2;
  
  return score;
}

// Fetch content from web and check similarity
export async function fetchAndCheckSimilarity(text) {
  try {
    // Get embeddings for the input text
    const textEmbeddings = await getEmbeddings(text);
    
    // Check for AI characteristics
    const aiScore = await checkAICharacteristics(text);
    
    // Store results
    const results = [];
    
    // If AI characteristics are strong, add to results
    if (aiScore > 0.5) {
      results.push({
        type: 'ai-generated',
        similarity: aiScore,
        source: 'AI Pattern Analysis',
        confidence: aiScore
      });
    }
    
    // Query similar content from Supabase
    const { data: similarContent, error } = await supabase
      .rpc('match_documents', {
        query_embedding: textEmbeddings,
        match_threshold: 0.8,
        match_count: 5
      });
    
    if (error) throw error;
    
    // Add web content matches to results
    if (similarContent) {
      for (const content of similarContent) {
        const similarity = cosineSimilarity(textEmbeddings, content.embedding);
        if (similarity > 0.8) {
          results.push({
            type: 'web-content',
            similarity,
            source: content.source_url,
            text: content.content,
            confidence: similarity
          });
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error in similarity check:', error);
    throw error;
  }
}

// Store new detected content for future comparison
export async function storeDetectedContent(content) {
  try {
    const embeddings = await getEmbeddings(content.text);
    
    const { error } = await supabase
      .from('detected_content')
      .insert({
        content: content.text,
        embedding: embeddings,
        source_url: content.source,
        detection_type: content.type
      });
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error storing content:', error);
    throw error;
  }
}