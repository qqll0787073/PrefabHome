import type { Message, Product, QuoteRequest } from "./types";

export const products: Product[] = [
  {
    id: "house-20-fold",
    name: "20 ft Folding ADU Studio",
    category: "ADU",
    manufacturer: "Shenzhen Minimalist Tiny Home Tech",
    location: "Shenzhen, China",
    price: 28500,
    sizeSqFt: 320,
    leadTimeWeeks: 7,
    imageUrl:
      "https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&q=80&w=900",
    tags: ["Foldable", "ADU Ready", "Off-grid option"],
    description:
      "Compact folding residence with insulated panels, wet bath, kitchen line, and US-compatible electrical planning package.",
    compliance: ["NEC planning pack", "UPC plumbing allowance", "IBC review required"],
  },
  {
    id: "house-40-container",
    name: "40 ft Expandable Container Home",
    category: "Container House",
    manufacturer: "Wuhan SpacePod Space Capsule Cabin Co.",
    location: "Wuhan, China",
    price: 46200,
    sizeSqFt: 640,
    leadTimeWeeks: 9,
    imageUrl:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=900",
    tags: ["Expandable", "Export packed", "Solar ready"],
    description:
      "Two-bedroom expandable model with steel frame, finished interiors, and containerized shipping configuration.",
    compliance: ["Steel mill certs", "Factory QA packet", "Local foundation engineering required"],
  },
  {
    id: "house-cascade-tiny",
    name: "Cascade Mobile Tiny House",
    category: "Tiny House",
    manufacturer: "Qingdao Steel Villa Group",
    location: "Qingdao, China",
    price: 39600,
    sizeSqFt: 420,
    leadTimeWeeks: 8,
    imageUrl:
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&q=80&w=900",
    tags: ["Trailer-ready", "Loft", "Custom finishes"],
    description:
      "Tiny home shell and finish package designed for buyer customization, quote comparison, and logistics planning.",
    compliance: ["RV classification review", "ANSI planning notes", "County permit review required"],
  },
];

export const quoteRequests: QuoteRequest[] = [
  {
    id: "quote-001",
    productId: "house-40-container",
    productName: "40 ft Expandable Container Home",
    buyerName: "Mark Harrison",
    manufacturer: "Wuhan SpacePod Space Capsule Cabin Co.",
    status: "reviewing",
    budget: 80000,
  },
  {
    id: "quote-002",
    productId: "house-20-fold",
    productName: "20 ft Folding ADU Studio",
    buyerName: "Jane Smith",
    manufacturer: "Shenzhen Minimalist Tiny Home Tech",
    status: "quoted",
    budget: 52000,
  },
];

export const messages: Message[] = [
  {
    id: "msg-001",
    from: "Buyer",
    body: "Can the wall assembly be upgraded for colder climates?",
    time: "09:20",
  },
  {
    id: "msg-002",
    from: "Manufacturer",
    body: "Yes. We can quote a higher R-value panel package and update the packing list.",
    time: "09:34",
  },
];
