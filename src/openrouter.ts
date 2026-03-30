import dotenv from "dotenv";
import { OpenRouter } from "@openrouter/sdk";

dotenv.config();

const apiKey = process.env.OPENROUTER_API_KEY || "";

export const openrouter = new OpenRouter({ apiKey });
