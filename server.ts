import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.warn("WARNING: GEMINI_API_KEY is not defined. AI functions will run in simulated mode.");
}

// 1. AI Home Advisor API Endpoint
app.post("/api/advisor", async (req, res) => {
  const { query, budget, state, zipCode, landStatus, preferredType, previousMessages = [] } = req.body;

  if (!ai) {
    // Simulated fallback if API key is missing
    return res.json({
      text: `[SIMULATED ADVISOR] (API Key missing)
Based on your budget of $${budget || "any"} and preference for a ${preferredType || "prefab home"} in ${state || "US"} (ZIP: ${zipCode || "N/A"}), here is some guidance:
1. **Zoning & Permits**: Since you ${landStatus === "owned" ? "own land" : "do not own land yet"}, please verify local zoning regulations for ADUs or primary dwellings in your municipality. Texas and Florida have more permissive modular codes, while California has strict Title 24 energy compliance.
2. **Landed Cost Estimate**: A factory cost of $50,000 typically incurs $15,000 in ocean freight/duties and $10,000+ for local foundation and crane setup.
3. **Recommended Next Step**: Connect with verified manufacturers to request custom floor plans.

*Disclaimer: This is an AI advice summary. This platform is not a licensed builder or contractor. Verify all zoning, codes, and permits locally before making purchase commitments.*`,
    });
  }

  try {
    const formattedHistory = previousMessages.map((msg: any) => ({
      role: msg.sender === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    }));

    const contents = [
      ...formattedHistory,
      {
        role: "user",
        parts: [{
          text: `Buyer Inquiry Details:
- User Question/Query: "${query}"
- Estimated Budget: $${budget || "Not specified"}
- Target Location: State ${state || "Not specified"}, ZIP code ${zipCode || "Not specified"}
- Land Ownership: ${landStatus === "owned" ? "Owns land" : "Searching for land / rented"}
- Preferred House Type: ${preferredType || "Any / Prefab"}

Provide highly specific advice regarding:
1. Product categories matching their budget and requirements.
2. Estimated shipping & inland trucking considerations for ${state || "the United States"} (nearest ports).
3. Local zoning, ADU compliance, foundation types, and permitting recommendations.
4. Detailed next steps (contacting manufacturers, site preparation, crane hiring).
5. ALWAYS append a clear, friendly legal disclaimer at the very end stating that the buyer must verify local zoning, engineering, and building codes with county officials, and that the platform is not a licensed contractor.`
        }],
      }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: "You are 'PrefabHome AI Advisor', an expert consultant in cross-border modular home logistics, U.S. building codes (IBC/IRC, HUD, ADU laws, CA Title 24), and factory procurement in China. Provide detailed, helpful, structured, and realistic advice in English or Chinese based on user's query language. Be highly technical yet clear. Never state that you are just a language model.",
        temperature: 0.7,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini Advisor Error:", error);
    res.status(500).json({ error: "Failed to generate advice from Gemini", details: error.message });
  }
});

// 2. Real-Time Translation API Endpoint
app.post("/api/translate", async (req, res) => {
  const { text, targetLang } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Missing 'text' parameter for translation." });
  }

  if (!ai) {
    // Simulated fallback
    const isToChinese = targetLang === "zh";
    return res.json({
      translatedText: isToChinese 
        ? `[译] ${text} (翻译服务未连接API Key)`
        : `[Translation] ${text} (Translation service offline)`,
    });
  }

  try {
    const prompt = `Translate the following text into ${targetLang === "zh" ? "Simplified Chinese" : "American English"}. Provide ONLY the final translation, without any introduction, quotes, explanation, or notes.
Text to translate:
"""
${text}
"""`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.1,
      },
    });

    res.json({ translatedText: response.text?.trim() });
  } catch (error: any) {
    console.error("Gemini Translation Error:", error);
    res.status(500).json({ error: "Failed to translate", details: error.message });
  }
});

// 3. AI CRM - Outreach Draft Generation API
app.post("/api/crm/generate-email", async (req, res) => {
  const { companyName, contactPerson, province, city, products = [] } = req.body;

  if (!companyName) {
    return res.status(400).json({ error: "Missing companyName parameter" });
  }

  const productsStr = products.length > 0 ? products.join(", ") : "modular prefab housing units";

  if (!ai) {
    // Simulated fallback
    const draft = `Subject: Business Inquiry & Partnership Opportunity - Importation of Modular Buildings to the U.S.

Dear ${contactPerson || "Sales Director"} of ${companyName},

My name is Marcus Reed, representing Alpha Prefab Development LLC based in Seattle, Washington. We are currently scouting premier Chinese manufacturers of high-quality prefabricated structures—specifically ${productsStr}—to import into the Pacific Northwest and California markets.

We reviewed your company's export profile in ${province || "China"} and are highly impressed with your manufacturing capabilities. To assess alignment, could you please provide us with the following materials:
1. Your latest export product catalog and comprehensive FOB price list.
2. Architectural CAD drawings / floor plans of your standard ADUs and capsule pods.
3. Export quality compliance documents (e.g., ISO9001, CE, CSA, or UL electrical component listings).

Are your plumbing and wiring systems pre-configured to comply with US building codes (such as standard UPC plumbing fittings and NEC pre-wiring)?

We can communicate in either English or Chinese (中文). We are prepared to sign an NDA if required to review custom designs. We look forward to your prompt response.

Best regards,

Marcus Reed
Procurement & Logistics Director
Alpha Prefab Development LLC
marcus.reed@alphaprefabusa.com | +1-206-555-0199`;

    return res.json({ draft });
  }

  try {
    const prompt = `Compose a highly professional, polite business outreach email in English from a US prefabricated housing importer/developer named 'Alpha Prefab Development LLC' (represented by Marcus Reed, Procurement Director) to a Chinese manufacturer named '${companyName}', addressing '${contactPerson || "Overseas Sales Director"}' in '${city || ""}, ${province || "China"}'. 

The email should:
1. Express strong interest in partnering to import high-quality modular structures, specifically focusing on their expertise in '${productsStr}'.
2. Request their formal product catalog, full FOB price lists, basic CAD floor plans, and export compliance certifications (like CE, ISO9001, or UL listings).
3. Inquire specifically about engineering standard configurations for the U.S. market, such as 110V/220V dual voltage wiring matching NEC standards and UPC plumbing compliance.
4. Mention that we have active projects in California or Texas and are eager to establish a long-term purchasing relationship.
5. Close by noting we are happy to communicate in either English or Chinese (中文) to facilitate coordination.

Provide only the email content with Subject and Body, no other intro or outro.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
        systemInstruction: "You are an experienced international procurement manager specialized in sourcing prefabricated structures, modular homes, and tiny houses from Chinese suppliers. Write polite, persuasive, and technically detailed sourcing inquiry emails.",
      },
    });

    res.json({ draft: response.text });
  } catch (error: any) {
    console.error("Gemini Email Generator Error:", error);
    res.status(500).json({ error: "Failed to generate email draft", details: error.message });
  }
});

// 4. AI CRM - Manufacturer Response Simulation API
app.post("/api/crm/generate-reply", async (req, res) => {
  const { companyName, contactPerson, province, city, products = [] } = req.body;

  if (!companyName) {
    return res.status(400).json({ error: "Missing companyName parameter" });
  }

  const productsStr = products.length > 0 ? products[0] : "ADU Cabin";

  if (!ai) {
    // Fallback simulation
    const replyText = `Subject: Re: Business Inquiry & Partnership Opportunity - ${companyName}

Dear Marcus Reed,

Thank you very much for contacting ${companyName}! We are extremely pleased to receive your inquiry regarding our modular housing structures.

Our factory, located in ${city || province || "China"}, has over 10 years of experience exporting to North America, Australia, and Europe. We are fully ISO9001 certified and our materials comply with CE standards. Yes, we routinely pre-configure our models with US-compliant electrical systems (UL-listed wires, 110V outlets, US standard breakers) and standard 3/4" NPT water inlet plumbing.

We are excited to share our export portfolio with you. Attached to this email, please find:
1. K-HOME Prefab Catalog 2026.pdf
2. Standard FOB Price List.xlsx
3. CAD Structural Seals.zip

Specifically, we recommend two of our most popular standard models that are perfect for California and Texas yards:

1. Space Capsule Cabin Model: "Nebula-X Pod"
   - Dimensions: 8.5m x 2.25m x 2.6m
   - Area: 205 sq ft
   - FOB Price: $29,500 USD
   - Key Features: Aviation aluminum shell, double-layer tempered privacy glass, smart home central voice control, underfloor heating, fully integrated toilet, and pre-wired standard US distribution box.

2. Expandable Modular Home: "FlexSpace-20"
   - Dimensions: 5.9m x 6.3m x 2.5m (expanded)
   - Area: 400 sq ft
   - FOB Price: $14,800 USD
   - Key Features: 10-minute rapid unfold mechanism, galvanized heavy steel frame, flame-retardant EPS sandwich insulation wall panels, dual bedrooms, and built-in bathroom.

We look forward to arranging a video meeting over Zoom or WeChat.

Best regards,

${contactPerson || "Sales Team"}
International Trade Department
${companyName}

[HIDDEN SPECIFICATION SHEET JSON FOR PLATFORM EXTRACTION]
\`\`\`json
[
  {
    "name": "${productsStr.includes("Capsule") ? "Nebula-X Smart Capsule" : "Nebula-X Pod"}",
    "modelNumber": "NX-POD-350",
    "category": "Tiny House",
    "price": 29500,
    "size": "8.5m x 2.25m x 2.6m",
    "area": 205,
    "description": "Premium double-layer vacuum glass aviation aluminum capsule. Integrated smart lighting, dry-wet separation luxury bathroom, and pre-wired US breakers."
  },
  {
    "name": "${productsStr.includes("Expandable") ? "FlexSpace-20 Folding Villa" : "FlexSpace-20"}",
    "modelNumber": "FS-20-EXP",
    "category": "Modular House",
    "price": 14800,
    "size": "5.9m x 6.3m x 2.5m",
    "area": 400,
    "description": "Double-wing rapid expansion structural housing unit. Pre-assembled PVC flooring, light steel subframes, complete kitchen counter, and toilet facilities."
  }
]
\`\`\``;

    return res.json({ replyText });
  }

  try {
    const prompt = `Simulate a formal reply email from Chinese manufacturer '${companyName}', represented by contact person '${contactPerson || "Sales Representative"}' based in '${city || province || "China"}'. They are replying to Marcus Reed from Alpha Prefab Development LLC.

The email MUST:
1. Be written primarily in polite, warm business Chinese (representing a professional exporter), with an elegant paragraph-by-paragraph English translation or bilingual structure.
2. Confirm receipt of their inquiry, express enthusiasm for the U.S. partnership, and confirm their factory has ample experience complying with U.S. electrical codes (NEC, UL components) and plumbing standards (UPC fittings).
3. Introduce exactly TWO highly detailed prefabricated models they specialize in (e.g., matching '${productsStr}' or similar categories).
4. For each model, specify the model's marketing name, a technical model number, FOB price in USD, precise structural dimensions, interior area in square feet, and a brief list of premium materials (such as galvanized steel framing, triple-glazed windows, polyurethane thermal core).
5. At the very end of your response, you MUST append a hidden JSON block enclosed in standard markdown code blocks \`\`\`json ... \`\`\` containing exactly those two models so our platform parser can extract them. The JSON schema must strictly contain an array of two objects with these fields: "name" (string), "modelNumber" (string), "category" (string e.g. "Tiny House" or "Modular House"), "price" (number, USD value like 32000), "size" (string e.g. "5.9m x 2.4m x 2.6m"), "area" (number, sq ft), and "description" (string, brief 2-sentence specs).

Ensure the email sounds like an authentic, professional, highly organized Chinese exporter who is extremely eager to win a large U.S. developer contract.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
        systemInstruction: "You are a bilingual Chinese prefabricated home exporter specializing in international B2B negotiations. Write courteous, technically thorough, and detailed email responses in Chinese and English.",
      },
    });

    res.json({ replyText: response.text });
  } catch (error: any) {
    console.error("Gemini Email Reply Generator Error:", error);
    res.status(500).json({ error: "Failed to generate supplier reply", details: error.message });
  }
});

// 5. AI Import Assistant - Land Zoning & ADU Compliance Checker API
app.post("/api/import/zoning-check", async (req, res) => {
  const { address, parcelNumber, zipCode, state, homeModel, category } = req.body;

  if (!state) {
    return res.status(400).json({ error: "Missing state parameter for zoning verification" });
  }

  if (!ai) {
    // Simulated fallback
    return res.json({
      feasibilityIndex: 7,
      guidance: `### 📋 Zoning Feasibility Analysis for ${state} (ZIP: ${zipCode || "N/A"})

Based on the selected model **${homeModel || "Prefab House"}** (Category: *${category || "Tiny House"}*), here is the zoning and installation feasibility breakdown:

1. **State-Level ADU Laws**:
   - ${state === "CA" || state === "California" 
       ? "California state law (SB 9 / AB 68) heavily favors ADU development. Local jurisdictions MUST approve compliant ADU projects through ministerial review within 60 days, bypassing discretionary public hearings. Local HOAs are generally prohibited from banning ADUs."
       : state === "TX" || state === "Texas"
       ? "Texas operates under standard county building permits. In unincorporated areas, zoning rules are very relaxed, and you can install modular homes with basic septic/foundation permits. However, incorporated cities (like Austin or Houston ETJ) have strict municipal zoning codes."
       : state === "FL" || state === "Florida"
       ? "Florida allows accessory structures but is highly sensitive to wind loads. Prefab houses MUST carry local wind zone certification (130-150 MPH ratings) and typically require engineered permanent concrete slab foundation designs."
       : `For ${state || "your state"}, accessory dwelling unit (ADU) laws vary by local city/county planning departments. Most regions require the structure to comply with the International Residential Code (IRC) or local HUD-approved manufactured housing standards.`
     }

2. **Permitting & Foundations**:
   - **Foundation Required**: Yes, a engineered concrete slab or screw-pile foundation is highly recommended for permanent structures.
   - **Building Permits**: Standard structural, plumbing, and electrical permits will be required from your county's planning department. You must submit structural and wiring diagrams (Chinese factory diagrams will need custom translation or stamp from a local US engineer).

3. **Zoning Code Reminders**:
   - **Setbacks**: Minimum front yard setback (typically 15-25ft) and side/rear setbacks (typically 4-10ft) must be observed.
   - **HOA & Land Deeds**: Check if your HOA has restrictive covenants. HOAs can often ban "moveable tiny houses" or "shipping containers", but state laws might override them if classified as permanent ADUs.

---
*Legal Disclaimer: This analysis is simulated because the platform is offline. This is for general educational planning purposes. You MUST check with your local County Building & Zoning Department using the Parcel Number: **${parcelNumber || "N/A"}** before purchasing.*`
    });
  }

  try {
    const prompt = `Perform a comprehensive technical feasibility analysis and zoning review for an American buyer planning to install a prefabricated modular structure in the US.
    
    Land/Site Information:
    - Address: "${address || "Not provided"}"
    - State: "${state}"
    - ZIP Code: "${zipCode || "Not provided"}"
    - Parcel Number / APN: "${parcelNumber || "Not provided"}"
    
    Selected Prefab House/Structure:
    - Model Name: "${homeModel || "Generic Prefab Modular Structure"}"
    - Structure Category: "${category || "Tiny House / ADU / Capsule Pod"}"
    
    Write a detailed, professional, structured evaluation report for the buyer in the language they requested (provide English with Chinese annotations where appropriate). It must cover:
    1. A 'Feasibility Score' (number from 1 to 10) representing ease of approval and compliance based on typical regulations in state "${state}" and ZIP code "${zipCode}".
    2. Specific ADU (Accessory Dwelling Unit) and Tiny House regulations for state "${state}" (e.g. mention California AB-68/SB-9 state mandates if California, Florida wind load requirements, Texas county permissions, etc.).
    3. Structural foundation suggestions (slab, piers, piles) matching this category.
    4. Building Permit documentation required (including engineering stamp requirements, factory CAD drawing translation, and electrical/plumbing compliance with US NEC and UPC standards).
    5. HOA (Homeowners Association) or zoning restriction warning indicators (setbacks, minimum floor areas, exterior material constraints).
    6. Practical step-by-step checklist of actions for the buyer to execute next with their local planning department using their Parcel Number "${parcelNumber || "Not provided"}".
    7. Clean, bold friendly formatting utilizing rich Markdown with no generic AI preamble. End with a legal disclaimer stating this does not constitute registered legal or structural engineering advice.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.5,
        systemInstruction: "You are 'PrefabHome Legal & Zoning compliance expert', advising American buyers on zoning codes, land covenants, permitting, ADU regulations, and engineered stamps needed to legally import and erect modular homes from China.",
      },
    });

    // Calculate a realistic score between 4 and 10 based on state (CA/TX/FL are usually easier/medium, cold/dense states can be harder)
    let score = 7;
    const st = state.toUpperCase().trim();
    if (["CA", "CALIFORNIA", "TX", "TEXAS", "FL", "FLORIDA", "AZ", "ARIZONA"].includes(st)) {
      score = 8;
    } else if (["NY", "NEW YORK", "MA", "MASSACHUSETTS", "NJ", "NEW JERSEY"].includes(st)) {
      score = 5;
    }

    res.json({
      feasibilityIndex: score,
      guidance: response.text
    });
  } catch (error: any) {
    console.error("Gemini Zoning Advisor Error:", error);
    res.status(500).json({ error: "Failed to generate zoning check from Gemini", details: error.message });
  }
});

// Serve static assets and handle routing
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer();
