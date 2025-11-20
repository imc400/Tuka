
import { GoogleGenAI, Type } from "@google/genai";
import { Store } from "../types";
import { fetchShopifyStore, getRegisteredConfigs } from "./shopifyService";

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey });

export const generateMarketplaceData = async (): Promise<Store[]> => {
  let stores: Store[] = [];

  // 1. Fetch All Real Stores registered in Admin Console
  const registeredConfigs = await getRegisteredConfigs();
  
  // Fetch in parallel for speed
  const realStorePromises = registeredConfigs.map(config => fetchShopifyStore(config));
  const realStoresResults = await Promise.all(realStorePromises);
  
  // Filter out failed requests (nulls)
  realStoresResults.forEach(store => {
    if (store) stores.push(store);
  });

  // 2. Fetch AI Generated Stores (to fill the marketplace)
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a realistic dataset for a "Shopify Marketplace App". 
      I need 4 distinct fictional stores to compliment the real ones. 
      - Categories should vary: Streetwear, Organic Cosmetics, Tech Accessories, Home Decor, Pet Supplies.
      - Each store must have a unique theme color (hex code).
      - Each store must have 4 unique products.
      - Prices should be realistic numbers.
      - 'imagePrompt' should be a single noun to use as a seed for an image generator (e.g. "shoe", "coffee", "watch").
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              category: { type: Type.STRING },
              description: { type: Type.STRING },
              themeColor: { type: Type.STRING },
              products: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    price: { type: Type.NUMBER },
                    imagePrompt: { type: Type.STRING }
                  },
                  required: ["id", "name", "description", "price", "imagePrompt"]
                }
              }
            },
            required: ["id", "name", "category", "description", "themeColor", "products"]
          }
        }
      }
    });

    if (response.text) {
      const aiData = JSON.parse(response.text) as Store[];
      stores = [...stores, ...aiData];
    }
  } catch (error) {
    console.error("Failed to generate store data", error);
    // Fallback if AI fails
    if (stores.length === 0) {
       stores.push({
        id: "s1",
        name: "Urban Pulse",
        category: "Streetwear",
        description: "Modern fits for the urban explorer.",
        themeColor: "#10b981",
        products: [
          { id: "p1", name: "Cargo Joggers", description: "Comfort fit", price: 59.99, imagePrompt: "pants" }
        ]
      });
    }
  }
  
  return stores;
};
