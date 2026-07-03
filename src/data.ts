import { Product, ManufacturerProfile, QuoteRequest, Review, Message, Notification, Quotation } from "./types";

export const INITIAL_MANUFACTURERS: ManufacturerProfile[] = [
  {
    id: "mfg_hz_modular",
    companyName: "Hangzhou Smart Modular Housing Co., Ltd.",
    contactPerson: "David Zheng (郑卫国)",
    email: "david.zheng@smart-modular.cn",
    phone: "+86 139 5711 8899",
    address: "No. 88 Xiaoshan Industrial Zone, Hangzhou, Zhejiang, China",
    website: "https://www.smart-modular.cn",
    exportExperience: "8 Years to North America & EU",
    certifications: ["ISO9001", "CE", "CSA (Canadian Standards Association)", "UL Listed Electrical Materials"],
    status: "approved",
    factoryPhotos: ["https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=600"]
  },
  {
    id: "mfg_qd_steel",
    companyName: "Qingdao Heavy Steel Modular Villas Ltd.",
    contactPerson: "Linda Wong (王美玲)",
    email: "linda.wong@qd-steelvilla.com",
    phone: "+86 186 6988 5522",
    address: "No. 126 Jimo High-Tech Park, Qingdao, Shandong, China",
    website: "http://www.qd-steelvilla.com",
    exportExperience: "12 Years",
    certifications: ["ISO9001", "AISC (American Institute of Steel Construction)", "CE", "Standards Australia"],
    status: "approved",
    factoryPhotos: ["https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&q=80&w=600"]
  },
  {
    id: "mfg_sz_tiny",
    companyName: "Shenzhen Minimalist Tiny Home Technology Co., Ltd.",
    contactPerson: "Leo Chan (陈志强)",
    email: "sales@sz-minimalist.cn",
    phone: "+86 135 1088 6677",
    address: "Bldg A4, Longhua Creative Park, Shenzhen, Guangdong, China",
    website: "http://www.sz-minimalist.cn",
    exportExperience: "5 Years",
    certifications: ["ISO9001", "FCC", "CE", "EPA Compliant Materials"],
    status: "approved",
    factoryPhotos: ["https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=600"]
  },
  {
    id: "mfg_wh_space",
    companyName: "Wuhan SpacePod Space Capsule Cabin Co.",
    contactPerson: "Gavin Zhao (赵世杰)",
    email: "gavin.zhao@spacepod.com.cn",
    phone: "+86 130 0711 3344",
    address: "East Lake High-Tech Zone, Wuhan, Hubei, China",
    website: "http://www.spacepod.com.cn",
    exportExperience: "4 Years",
    certifications: ["ISO9001", "CE", "RoHS", "UL Plumbing Compliant"],
    status: "pending",
    factoryPhotos: ["https://images.unsplash.com/photo-1513828722001-c226f1644b95?auto=format&fit=crop&q=80&w=600"]
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod_cascade_tiny",
    name: "Cascade Mobile Tiny House",
    modelNumber: "TH-350-CAS",
    category: "Tiny House",
    manufacturerId: "mfg_sz_tiny",
    manufacturerName: "Shenzhen Minimalist Tiny Home Technology Co., Ltd.",
    price: 32500,
    size: "8.5m x 2.4m x 3.8m (28ft L x 8ft W x 12.5ft H)",
    area: 220,
    bedrooms: 1,
    bathrooms: 1,
    hasKitchen: true,
    productionTime: 25,
    shippingAvailability: "Global Ports",
    image: "https://images.unsplash.com/photo-1525113990974-3f4e247b4478?auto=format&fit=crop&q=80&w=800",
    imageGallery: [
      "https://images.unsplash.com/photo-1525113990974-3f4e247b4478?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1548623917-2fbf0f0254fe?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=600"
    ],
    floorPlan: "Main level cozy living room + fully functional kitchen and wet bathroom. Loft fits a king-size bed with custom stairs and built-in storage drawers.",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    description: "A luxury trailer-mounted tiny home featuring cedar cladding, double glazed thermal windows, dual-burner electric cooktop, and US standard NEC electrical panels. Pre-wired for 50A hookup.",
    structureMaterial: "Galvanized steel trailer chassis + Light steel frame structure",
    wallMaterial: "Canadian red cedar exterior wood siding + Fiberglass insulation board + Bamboo fiber interior wall panels",
    roofMaterial: "Color-coated galvanized steel roofing sheets with thermal insulation layer",
    windowType: "Double-pane tempered glass aluminum alloy casement windows with screens",
    insulation: "R-19 Polyurethane spray foam + glass wool layers",
    electricalSystem: "US National Electrical Code (NEC) compliant wiring, 110V/50A distribution panel, GFCI outlets, UL-certified switches",
    plumbingSystem: "US Uniform Plumbing Code (UPC) certified PEX piping, standard 3/4-inch brass water inlet, PVC drainage outlet",
    weight: 4200,
    requiredContainers: "Flatbed / Roll-on Roll-off trailer shipping (can fit 1x 40FR)",
    isCustomizable: true,
    isSuitableForOffGrid: true,
    isSuitableForAdu: true,
    warranty: "5-Year Structural Frame Warranty, 1-Year Interior Finish Warranty",
    certifications: ["CE", "ISO9001", "EPA Compliant Subfloor", "UL-Listed Breakers"]
  },
  {
    id: "prod_pacific_adu",
    name: "Pacific Modern ADU 450",
    modelNumber: "ADU-450-PAC",
    category: "ADU",
    manufacturerId: "mfg_hz_modular",
    manufacturerName: "Hangzhou Smart Modular Housing Co., Ltd.",
    price: 48900,
    size: "11.5m x 3.6m x 2.9m (38ft L x 12ft W x 9.5ft H)",
    area: 450,
    bedrooms: 1,
    bathrooms: 1,
    hasKitchen: true,
    productionTime: 30,
    shippingAvailability: "Global Ports",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800",
    imageGallery: [
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=600"
    ],
    floorPlan: "Open-plan modern kitchen and spacious living room with dynamic glass facade. Private bedroom with fitted closet and luxury walk-in tile shower.",
    videoUrl: "https://www.w3schools.com/html/movie.mp4",
    description: "Designed specifically to meet California ADU Assembly Bill requirements. High insulation rating (R-30 roof, R-21 walls), pre-engineered seismic reinforcements, ready for concrete slab foundation bolting.",
    structureMaterial: "Heavy-gauge hot-dip galvanized steel framing with anti-corrosion coating",
    wallMaterial: "Fiber cement siding boards + OSB sheathing + high-density rockwool + gypsum wallboard (primed, ready for paint)",
    roofMaterial: "EPDM waterproof membrane with integrated aluminum drainage channels",
    windowType: "High-performance Low-E double-glazed argon-filled vinyl frame windows",
    insulation: "R-21 rockwool in walls, R-30 polyurethane insulation in floor and ceiling",
    electricalSystem: "Pre-wired 120V/240V, 100A main service panel, recessed LED lighting, smart thermostat wiring",
    plumbingSystem: "PEX hot/cold pipes, copper drains, standard toilet flange pre-cut, tankless electric water heater",
    weight: 8500,
    requiredContainers: "1x 40HQ Container (Fully folded and flat-packed modules)",
    isCustomizable: true,
    isSuitableForOffGrid: false,
    isSuitableForAdu: true,
    warranty: "10-Year Anti-Rust Warranty, 3-Year Plumbing/Electrical Warranty",
    certifications: ["ICC-ES Evaluated Steel", "Energy Star Certified Windows", "UL Listed Wire & Pipes"]
  },
  {
    id: "prod_nebula_capsule",
    name: "Nebula Future Space Capsule",
    modelNumber: "SC-100-NEB",
    category: "Cabin",
    manufacturerId: "mfg_hz_modular",
    manufacturerName: "Hangzhou Smart Modular Housing Co., Ltd.",
    price: 24500,
    size: "8.5m x 3.2m x 3.0m (28ft L x 10.5ft W x 10ft H)",
    area: 270,
    bedrooms: 1,
    bathrooms: 1,
    hasKitchen: false,
    productionTime: 20,
    shippingAvailability: "All Major Ports",
    image: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&q=80&w=800",
    imageGallery: [
      "https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&q=80&w=600"
    ],
    floorPlan: "Integrated smart capsule bedroom + panoramic star window dome, premium workspace desk, and intelligent wet-dry partition shower capsule.",
    description: "An ultra-futuristic, aerodynamic glamping pod with an aerospace-grade aluminum alloy exterior shell, poly-carbonate panorama sky window, smart control system, and app-controlled LED ambient lights.",
    structureMaterial: "Aviation-grade aluminum alloy outer cover shell + reinforced Q235 steel chassis",
    wallMaterial: "Double-layer thermal vacuum insulated panels with white fiberglass interior finishing",
    roofMaterial: "Curved 12mm panoramic tinted polycarbonate starview roof dome",
    windowType: "Double tempered tinted hurricane-proof glass wall panels",
    insulation: "100mm fireproof polyurethane spray foam insulation layer",
    electricalSystem: "Smart control panel (voice, app, keyless RFID card entry), 110V/30A power load, dimmable RGB LED tracks",
    plumbingSystem: "Direct quick-connect water system, heavy-duty grey/black water electric discharge pumps",
    weight: 3800,
    requiredContainers: "1x 40HQ Container (completely pre-assembled, direct lift out of ship)",
    isCustomizable: false,
    isSuitableForOffGrid: true,
    isSuitableForAdu: true,
    warranty: "3-Year Structural Shell Warranty, 2-Year Electronic Appliance Warranty",
    certifications: ["CE", "RoHS", "UL Smart Panel", "ISO9001"]
  },
  {
    id: "prod_garden_office",
    name: "Zen Silence Garden Office",
    modelNumber: "GO-120-ZEN",
    category: "Garden Office",
    manufacturerId: "mfg_sz_tiny",
    manufacturerName: "Shenzhen Minimalist Tiny Home Technology Co., Ltd.",
    price: 15800,
    size: "4.0m x 2.8m x 2.6m (13ft L x 9ft W x 8.5ft H)",
    area: 120,
    bedrooms: 0,
    bathrooms: 0,
    hasKitchen: false,
    productionTime: 15,
    shippingAvailability: "Global Ports",
    image: "https://images.unsplash.com/photo-1544984243-ec57ea16fe25?auto=format&fit=crop&q=80&w=800",
    imageGallery: [
      "https://images.unsplash.com/photo-1544984243-ec57ea16fe25?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&q=80&w=600"
    ],
    floorPlan: "Single-room studio layout with soundproof acoustics, triple glass windows facing the garden, and custom wood veneer workstation layout.",
    description: "The ultimate acoustic soundproof home office pod. Fits effortlessly into a backyard, requiring no heavy foundations (can rest on gravel or timber pads). Prefabricated in 1 day installation.",
    structureMaterial: "Light gauge cold-formed steel framework",
    wallMaterial: "Acoustic insulation panels with real bamboo wood slatted cladding facade",
    roofMaterial: "Single-ply PVC membrane with built-in micro guttering system",
    windowType: "Sound-dampening triple-pane safety glass sliding doors with security lock",
    insulation: "High density glasswool + sound isolation membrane (STC 45 Rating)",
    electricalSystem: "4x double US outlets, 2x USB charge ports, 1x Ethernet Port, recessed ceiling spotlights",
    plumbingSystem: "None (Dry Office module)",
    weight: 1900,
    requiredContainers: "1x 20GP Container or LCL shared loading (shipped flat-packed)",
    isCustomizable: true,
    isSuitableForOffGrid: true,
    isSuitableForAdu: false,
    warranty: "3-Year Weatherproof Siding Warranty, 1-Year Electrical",
    certifications: ["ISO9001", "Acoustic Decibel STC-45 Certification", "CE"]
  },
  {
    id: "prod_steel_villa",
    name: "Tuscan Elite Steel Villa",
    modelNumber: "SV-1200-TUS",
    category: "Steel Villa",
    manufacturerId: "mfg_qd_steel",
    manufacturerName: "Qingdao Heavy Steel Modular Villas Ltd.",
    price: 85000,
    size: "12.0m x 9.5m x 6.4m (40ft L x 31ft W x 21ft H) - 2 Floors",
    area: 1200,
    bedrooms: 3,
    bathrooms: 2,
    hasKitchen: true,
    productionTime: 45,
    shippingAvailability: "Global Sea Ports",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=800",
    imageGallery: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=600"
    ],
    floorPlan: "Level 1: Large gourmet kitchen, living hall, formal dining, and half bath. Level 2: Master suite with private deck, two secondary bedrooms, and a full shared bath.",
    description: "A gorgeous 2-story luxury modular villa designed to withstand up to Category 4 hurricanes (140mph wind loads) and Seismic Zone 4 forces. Shipped in 3 main modules that link seamlessly onsite.",
    structureMaterial: "Heavy H-beam steel primary framing + Q355 steel joist subfloors",
    wallMaterial: "Insulated sandwich panel cores + luxury faux-stone siding first floor + stucco siding upper floor",
    roofMaterial: "Clay-look resin tiles + structural plywood + high-performance vapor barrier + steel rafters",
    windowType: "Hurricane-rated impact-resistant double pane vinyl clad windows",
    insulation: "R-38 fiberglass attic insulation, R-25 composite wall insulation",
    electricalSystem: "Full 200A multi-breaker panel, pre-piped PVC fire-retardant conduits with fish wire, ready for local US wire pulling",
    plumbingSystem: "Dual plumbing layout (city connect + gray water harvesting ready), ABS drain system",
    weight: 24000,
    requiredContainers: "3x 40HQ Containers (Modular shipping packages, crane needed)",
    isCustomizable: true,
    isSuitableForOffGrid: false,
    isSuitableForAdu: false,
    warranty: "25-Year Structural Integrity Guarantee, 5-Year Weather-tight Siding Warranty",
    certifications: ["AISC", "AWS (American Welding Society) Welder Certified", "CE", "IBC Compliant Structure"]
  }
];

export const INITIAL_QUOTES: QuoteRequest[] = [
  {
    id: "quote_001",
    buyerName: "Mark Harrison",
    buyerEmail: "m.harrison@gmail.com",
    buyerPhone: "+1 (512) 555-0144",
    productId: "prod_cascade_tiny",
    productModel: "Cascade Mobile Tiny House",
    manufacturerId: "mfg_sz_tiny",
    manufacturerName: "Shenzhen Minimalist Tiny Home Technology Co., Ltd.",
    quantity: 1,
    budget: 45000,
    projectLocation: "Austin, Texas",
    zipCode: "78701",
    landStatus: "owned",
    needInstallationSupport: true,
    needFinancing: false,
    needPermitAssistance: true,
    customizationRequest: "I want to add a solar array pack (6x 400W panels + 10kWh battery bank) for complete off-grid use, and upgrade insulation from standard spray foam to 120mm bio-wool.",
    uploadedFiles: ["site-plan-austin.pdf", "land-photo-1.jpg"],
    status: "quotation_sent",
    date: "2026-06-28"
  },
  {
    id: "quote_002",
    buyerName: "Sarah Jenkins",
    buyerEmail: "s.jenkins@yahoo.com",
    buyerPhone: "+1 (415) 332-9842",
    productId: "prod_pacific_adu",
    productModel: "Pacific Modern ADU 450",
    manufacturerId: "mfg_hz_modular",
    manufacturerName: "Hangzhou Smart Modular Housing Co., Ltd.",
    quantity: 1,
    budget: 65000,
    projectLocation: "San Jose, California",
    zipCode: "95112",
    landStatus: "owned",
    needInstallationSupport: true,
    needFinancing: true,
    needPermitAssistance: true,
    customizationRequest: "Need to verify if this model has Title 24 compliance certificates for California. Also need the bathroom layout modified to support a wider ADA-compliant door.",
    uploadedFiles: ["backyard-dim-cad.pdf"],
    status: "submitted",
    date: "2026-07-02"
  },
  {
    id: "quote_003",
    buyerName: "Robert Miller",
    buyerEmail: "rmiller@millerbuild.com",
    buyerPhone: "+1 (305) 884-3311",
    productId: "prod_steel_villa",
    productModel: "Tuscan Elite Steel Villa",
    manufacturerId: "mfg_qd_steel",
    manufacturerName: "Qingdao Heavy Steel Modular Villas Ltd.",
    quantity: 1,
    budget: 120000,
    projectLocation: "Orlando, Florida",
    zipCode: "32801",
    landStatus: "owned",
    needInstallationSupport: true,
    needFinancing: false,
    needPermitAssistance: false,
    customizationRequest: "Requires engineering seals and calculations for 150mph wind design load according to Florida Building Code (FBC). We will pull local permits ourselves.",
    uploadedFiles: ["soil-report.pdf", "orlando-plat-map.png"],
    status: "ordered",
    date: "2026-05-15"
  }
];

export const INITIAL_QUOTATIONS: Quotation[] = [
  {
    id: "qtn_101",
    quoteRequestId: "quote_001",
    productId: "prod_cascade_tiny",
    productModel: "Cascade Mobile Tiny House",
    basePrice: 32500,
    customizationCost: 5500, // Solar array & thick insulation
    estimatedShippingCost: 6500, // Ocean to Houston Port + inland truck to Austin
    estimatedProductionTime: 28,
    paymentTerms: "50% deposit via bank wire to secure production slots, 50% upon third-party video quality inspection before container sealing.",
    validityPeriod: "45 Days",
    notes: "Quote includes 6x Mono-crystalline 400W panels + 10kWh LFP power wall, dual voltage hybrid inverter. Standard structural frame engineered to CSA standards.",
    date: "2026-06-30"
  },
  {
    id: "qtn_103",
    quoteRequestId: "quote_003",
    productId: "prod_steel_villa",
    productModel: "Tuscan Elite Steel Villa",
    basePrice: 85000,
    customizationCost: 12000, // Wind load engineer stamp
    estimatedShippingCost: 16500, // 3x 40HQ shipping & overland truck to Orlando
    estimatedProductionTime: 45,
    paymentTerms: "30% initial deposit, 40% when steel framing assembly is finalized, 30% upon customs clearance in US.",
    validityPeriod: "60 Days",
    notes: "Includes structural calculations signed by licensed US structural engineer. Interior drywalls supplied in complete panels with pre-drilled plumbing paths.",
    date: "2026-05-18"
  }
];

export const INITIAL_REVIEWS: Review[] = [
  {
    id: "rev_001",
    productId: "prod_cascade_tiny",
    productName: "Cascade Mobile Tiny House",
    buyerName: "Mark Harrison",
    rating: 5,
    text: "Absolutely stunning tiny house! Shenzhen Minimalist customized the window arrangement and added custom cabinets. Arrived in Houston Port, cleared customs without issues, and is now serving as my off-grid Airbnb. Build quality exceeds local US tiny homes costing double.",
    date: "2026-06-12"
  },
  {
    id: "rev_002",
    productId: "prod_pacific_adu",
    productName: "Pacific Modern ADU 450",
    buyerName: "Jameson Carter",
    rating: 4,
    text: "Hangzhou Smart Modular built a solid unit. Siding is high-quality fiber cement. We had a slight delay at the Port of Los Angeles due to agricultural inspection, but the factory coordinator Linda stayed up on WeChat to send compliance docs instantly. Highly professional.",
    date: "2026-05-04"
  }
];

export const INITIAL_MESSAGES: Message[] = [
  {
    id: "msg_001",
    fromId: "buyer_mark",
    fromName: "Mark Harrison",
    toId: "mfg_sz_tiny",
    toName: "Shenzhen Minimalist Tiny Home Tech",
    text: "Hello! I am very interested in TH-350-CAS. Can you ship it to Dallas, Texas? And can we configure the water connection to fit standard U.S. garden hose PEX threads?",
    translatedText: "你好！我对 TH-350-CAS 非常感兴趣。可以发货到德克萨斯州达拉斯吗？另外，水阀接头能配置成适配美国标准的 PEX 软管螺纹吗？",
    timestamp: "2026-06-25 10:30"
  },
  {
    id: "msg_002",
    fromId: "mfg_sz_tiny",
    fromName: "Shenzhen Minimalist Tiny Home Tech",
    toId: "buyer_mark",
    toName: "Mark Harrison",
    text: "您好 Mark！没问题的，我们可以发货到达拉斯（海运到休斯顿港，然后由美国当地平板拖车陆运运达）。关于给水系统，我们一律采用美标 3/4 英寸 NPT/G 级黄铜进水螺纹，100% 适配美国软管。这是我们标准的北美出口配置。",
    translatedText: "Hello Mark! No problem, we can ship to Dallas (ocean freight to Houston Port, then inland trucking via flatbed to Dallas). Regarding the water inlet, we strictly use US standard 3/4 inch NPT brass connection, which is 100% compatible with US garden hoses. This is our standard North American export spec.",
    timestamp: "2026-06-25 11:15"
  },
  {
    id: "msg_003",
    fromId: "buyer_mark",
    fromName: "Mark Harrison",
    toId: "mfg_sz_tiny",
    toName: "Shenzhen Minimalist Tiny Home Tech",
    text: "That is perfect! I will upload my land layout sketch in the quote request. Please review the trailer weight capacity since Texas requires registration.",
    translatedText: "太棒了！我将在询盘申请里上传我的土地规划草图。请审核车轴承重吨位，因为德州拖车上牌注册有强制要求。",
    timestamp: "2026-06-25 11:42"
  }
];

export const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: "notif_001",
    userId: "buyer_mark",
    text: "Shenzhen Minimalist sent a formal quotation for quote request #quote_001.",
    date: "2026-06-30 09:00",
    isRead: false
  },
  {
    id: "notif_002",
    userId: "mfg_sz_tiny",
    text: "New quote request received from Sarah Jenkins regarding 'Pacific Modern ADU 450'.",
    date: "2026-07-02 14:10",
    isRead: false
  },
  {
    id: "notif_003",
    userId: "admin_general",
    text: "Wuhan SpacePod factory applied for Manufacturer Status. Review pending.",
    date: "2026-07-03 08:00",
    isRead: true
  }
];
