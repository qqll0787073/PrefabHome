export type Role = "buyer" | "manufacturer" | "admin";

export type View =
  | "browse"
  | "dashboard"
  | "compare"
  | "advisor"
  | "import-center";

export interface Product {
  id: string;
  name: string;
  category: string;
  manufacturer: string;
  location: string;
  price: number;
  sizeSqFt: number;
  leadTimeWeeks: number;
  imageUrl: string;
  tags: string[];
  description: string;
  compliance: string[];
}

export interface QuoteRequest {
  id: string;
  productId: string;
  productName: string;
  buyerName: string;
  manufacturer: string;
  status: "submitted" | "reviewing" | "quoted" | "ordered";
  budget: number;
}

export interface Message {
  id: string;
  from: string;
  body: string;
  time: string;
}
