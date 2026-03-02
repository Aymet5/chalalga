import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateTuvanPoem = async (name: string, age: number) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Write a short, beautiful, and atmospheric birthday poem in Tuvan language for a man named ${name} who is turning ${age}. The poem should be respectful and celebratory.`,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating poem:", error);
    return "Төрээн хүнүң таварыштыр\nИзүү байыр чедирип тур мен!\nАас-кежик, кадыкшылды\nАрат-чонга күзээр-дир мен.";
  }
};
