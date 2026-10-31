/**
 * India Address & PIN Code Intelligence Library
 * Provides:
 * 1. Standard Indian States & Union Territories (proper Title Case)
 * 2. Prefix-based instant offline state detection
 * 3. PIN Code lookup for District, City, State, and Localities (with in-memory caching)
 * 4. State normalization helper (e.g. "gUJARAT" -> "Gujarat")
 */

export const INDIAN_STATES: readonly string[] = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

// 2-digit PIN code prefix mapping for instant zero-latency fallback
const PIN_PREFIX_STATE_MAP: Record<string, string> = {
  "11": "Delhi",
  "12": "Haryana",
  "13": "Haryana",
  "14": "Punjab",
  "15": "Punjab",
  "16": "Chandigarh",
  "17": "Himachal Pradesh",
  "18": "Jammu and Kashmir",
  "19": "Jammu and Kashmir",
  "20": "Uttar Pradesh",
  "21": "Uttar Pradesh",
  "22": "Uttar Pradesh",
  "23": "Uttar Pradesh",
  "24": "Uttarakhand",
  "25": "Uttar Pradesh",
  "26": "Uttarakhand",
  "27": "Uttar Pradesh",
  "28": "Uttar Pradesh",
  "30": "Rajasthan",
  "31": "Rajasthan",
  "32": "Rajasthan",
  "33": "Rajasthan",
  "34": "Rajasthan",
  "36": "Gujarat",
  "37": "Gujarat",
  "38": "Gujarat",
  "39": "Gujarat",
  "40": "Maharashtra",
  "41": "Maharashtra",
  "42": "Maharashtra",
  "43": "Maharashtra",
  "44": "Maharashtra",
  "45": "Madhya Pradesh",
  "46": "Madhya Pradesh",
  "47": "Madhya Pradesh",
  "48": "Madhya Pradesh",
  "49": "Chhattisgarh",
  "50": "Telangana",
  "51": "Andhra Pradesh",
  "52": "Andhra Pradesh",
  "53": "Andhra Pradesh",
  "56": "Karnataka",
  "57": "Karnataka",
  "58": "Karnataka",
  "59": "Karnataka",
  "60": "Tamil Nadu",
  "61": "Tamil Nadu",
  "62": "Tamil Nadu",
  "63": "Tamil Nadu",
  "64": "Tamil Nadu",
  "67": "Kerala",
  "68": "Kerala",
  "69": "Kerala",
  "70": "West Bengal",
  "71": "West Bengal",
  "72": "West Bengal",
  "73": "West Bengal",
  "74": "West Bengal",
  "75": "Odisha",
  "76": "Odisha",
  "77": "Odisha",
  "78": "Assam",
  "79": "Meghalaya",
  "80": "Bihar",
  "81": "Bihar",
  "82": "Jharkhand",
  "83": "Jharkhand",
  "84": "Bihar",
  "85": "Bihar",
};

/**
 * Normalizes any variation of state string (e.g. "gUJARAT", "gujarat", "GUJ") to standard Title Case
 */
export function normalizeIndianState(input: string): string {
  if (!input) return "";
  const clean = input.trim().toLowerCase();
  
  // Direct match in states list
  const found = INDIAN_STATES.find((s) => s.toLowerCase() === clean);
  if (found) return found;

  // Partial or alias matches
  if (clean.includes("gujarat") || clean === "guj") return "Gujarat";
  if (clean.includes("maharashtra") || clean === "mh") return "Maharashtra";
  if (clean.includes("delhi")) return "Delhi";
  if (clean.includes("rajasthan") || clean === "raj") return "Rajasthan";
  if (clean.includes("karnataka") || clean === "kar") return "Karnataka";
  if (clean.includes("tamil")) return "Tamil Nadu";
  if (clean.includes("telangana")) return "Telangana";
  if (clean.includes("andhra")) return "Andhra Pradesh";
  if (clean.includes("uttar pradesh") || clean === "up") return "Uttar Pradesh";
  if (clean.includes("uttarakhand") || clean === "uk") return "Uttarakhand";
  if (clean.includes("west bengal") || clean === "wb") return "West Bengal";
  if (clean.includes("madhya pradesh") || clean === "mp") return "Madhya Pradesh";
  if (clean.includes("punjab")) return "Punjab";
  if (clean.includes("haryana")) return "Haryana";
  if (clean.includes("kerala")) return "Kerala";
  if (clean.includes("odisha") || clean.includes("orissa")) return "Odisha";
  if (clean.includes("bihar")) return "Bihar";
  if (clean.includes("jharkhand")) return "Jharkhand";
  if (clean.includes("chhattisgarh")) return "Chhattisgarh";
  if (clean.includes("goa")) return "Goa";
  if (clean.includes("assam")) return "Assam";

  // Return formatted Title Case fallback
  return input
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export interface PincodeDetails {
  success: boolean;
  pincode: string;
  city: string;
  district: string;
  state: string;
  localities: string[];
  source?: "api" | "backend" | "prefix_fallback";
}

// In-memory cache for ultra-fast repeated typing
const pincodeCache = new Map<string, PincodeDetails>();

/**
 * Looks up Indian PIN Code details (City, District, State, Localities)
 * Uses Postal PIN API -> Backend API -> Prefix fallback
 */
export async function lookupPincode(pincode: string): Promise<PincodeDetails> {
  const clean = pincode.replace(/\D/g, "").slice(0, 6);
  if (clean.length !== 6) {
    return {
      success: false,
      pincode: clean,
      city: "",
      district: "",
      state: "",
      localities: [],
    };
  }

  // Check cache first
  if (pincodeCache.has(clean)) {
    return pincodeCache.get(clean)!;
  }

  const prefix = clean.slice(0, 2);
  const fallbackState = PIN_PREFIX_STATE_MAP[prefix] || "";

  // 1. Try public India Post API (CORS enabled, highly accurate)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`https://api.postalpincode.in/pincode/${clean}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.Status === "Success" && Array.isArray(data[0]?.PostOffice) && data[0].PostOffice.length > 0) {
        const offices = data[0].PostOffice;
        const first = offices[0];
        const stateNormalized = normalizeIndianState(first.State || fallbackState);

        // City preference: Block / Taluk (e.g. Nadiad) > City name > District (e.g. Kheda)
        const district = first.District ? first.District.trim() : "";
        const block = first.Block && first.Block.toUpperCase() !== "NA" ? first.Block.trim() : "";
        const exactOffice = offices.find((o: any) => o.Name && o.Name.toLowerCase() === block.toLowerCase())
          || offices.find((o: any) => o.BranchType === "Head Post Office")
          || first;
        const officeCity = exactOffice?.Name ? exactOffice.Name.replace(/\s+(H\.O|S\.O|B\.O)$/i, "").replace(/^[^-]+-\s*/, "").trim() : "";
        let finalCity = block || officeCity || district;
        if (finalCity.toLowerCase() === "naidiad") finalCity = "Nadiad";

        const localities: string[] = offices
          .map((o: any) => o.Name?.replace(/\s+(H\.O|S\.O|B\.O)$/i, "").trim())
          .filter(Boolean);

        const result: PincodeDetails = {
          success: true,
          pincode: clean,
          city: finalCity,
          district: district,
          state: stateNormalized,
          localities: Array.from(new Set(localities)),
          source: "api",
        };

        pincodeCache.set(clean, result);
        return result;
      }
    }
  } catch {
    // API timeout or network block -> try backend endpoint
  }

  // 2. Try Backend API
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
    const res = await fetch(`${apiUrl}/shiprocket/pincode-details?pincode=${clean}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && (data.city || data.state)) {
        const result: PincodeDetails = {
          success: true,
          pincode: clean,
          city: data.city || data.district || "",
          district: data.district || data.city || "",
          state: normalizeIndianState(data.state || fallbackState),
          localities: data.localities || [],
          source: "backend",
        };
        pincodeCache.set(clean, result);
        return result;
      }
    }
  } catch {
    // Ignore backend failure and proceed to offline fallback
  }

  // 3. Offline Prefix Fallback (Guaranteed to return state)
  const fallbackResult: PincodeDetails = {
    success: Boolean(fallbackState),
    pincode: clean,
    city: "",
    district: "",
    state: fallbackState,
    localities: [],
    source: "prefix_fallback",
  };

  if (fallbackState) {
    pincodeCache.set(clean, fallbackResult);
  }
  return fallbackResult;
}
