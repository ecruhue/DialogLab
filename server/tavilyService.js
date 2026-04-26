import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

let currentTavilyApiKey = process.env.TAVILY_API_KEY || "";

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_RESULTS = 3;
const MAX_QUERY_LENGTH = 500;

const INSURANCE_TERMS = [
  "insurance",
  "insured",
  "policy",
  "coverage",
  "carrier",
  "claim",
  "premium",
  "deductible",
  "liability",
  "underwriting",
  "adjuster",
];

const AUTO_TERMS = [
  "auto",
  "vehicle",
  "car",
  "collision",
  "vin",
  "driver",
  "motor",
  "property damage",
  "bodily injury",
  "uninsured motorist",
  "roadside",
];

const DETAIL_NEED_TERMS = [
  "details",
  "specific",
  "requirements",
  "limits",
  "state",
  "regulation",
  "compare",
  "difference",
  "what should",
  "how much",
  "minimum",
  "recommended",
  "latest",
  "current",
];

function containsAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripLongText(value, maxLength = 220) {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

function buildLookupQuery({ message, context, roleDescription }) {
  const parts = [
    normalizeText(message),
    stripLongText(context, 180),
    normalizeText(roleDescription),
    "Focus on factual, up-to-date US auto insurance details.",
  ].filter(Boolean);

  return parts.join(" ").slice(0, MAX_QUERY_LENGTH);
}

function normalizeTavilyResult(data, maxResults) {
  const answer = normalizeText(data?.answer);
  const results = Array.isArray(data?.results) ? data.results : [];
  const sources = results.slice(0, maxResults).map((result) => ({
    title: normalizeText(result?.title) || "Untitled source",
    url: normalizeText(result?.url),
  }));

  let summary = answer;
  if (!summary) {
    const snippets = results
      .slice(0, maxResults)
      .map((result) => normalizeText(result?.content))
      .filter(Boolean)
      .map((snippet) => stripLongText(snippet, 320));
    summary = snippets.join(" ");
  }

  return {
    summary: stripLongText(summary, 700),
    sources,
  };
}

export function setTavilyApiKey(apiKey) {
  currentTavilyApiKey = normalizeText(apiKey);
}

export function isTavilyConfigured() {
  return Boolean(currentTavilyApiKey);
}

export function shouldUseTavilyForInsuranceAutoContext({
  message = "",
  context = "",
  roleDescription = "",
  customAttributes = {},
} = {}) {
  if (!isTavilyConfigured()) {
    return false;
  }

  if (String(process.env.AVATAR_TAVILY_V1_ENABLED || "true").toLowerCase() === "false") {
    return false;
  }

  const mergedText = [
    normalizeText(message),
    normalizeText(context),
    normalizeText(roleDescription),
    normalizeText(JSON.stringify(customAttributes)),
  ]
    .join(" ")
    .toLowerCase();

  const hasInsurance = containsAny(mergedText, INSURANCE_TERMS);
  const hasAuto = containsAny(mergedText, AUTO_TERMS);
  const needsDetail = containsAny(mergedText, DETAIL_NEED_TERMS);

  return hasInsurance && hasAuto && needsDetail;
}

export async function tavilyInsuranceLookup({
  message = "",
  context = "",
  roleDescription = "",
  agentName = "unknown-agent",
  maxResults = DEFAULT_MAX_RESULTS,
} = {}) {
  if (!isTavilyConfigured()) {
    return {
      status: "skipped",
      reason: "tavily_not_configured",
      used: false,
    };
  }

  const query = buildLookupQuery({ message, context, roleDescription });
  if (!query) {
    return {
      status: "skipped",
      reason: "empty_query",
      used: false,
    };
  }

  const lookupStart = Date.now();

  try {
    console.log(`[${new Date().toISOString()}] Tavily lookup: agent=${agentName}`);

    const response = await axios.post(
      "https://api.tavily.com/search",
      {
        api_key: currentTavilyApiKey,
        query,
        search_depth: "basic",
        include_answer: true,
        include_raw_content: false,
        max_results: Math.max(1, Math.min(Number(maxResults) || DEFAULT_MAX_RESULTS, 5)),
      },
      {
        timeout: DEFAULT_TIMEOUT_MS,
      },
    );

    const normalized = normalizeTavilyResult(response?.data, DEFAULT_MAX_RESULTS);
    return {
      status: "ok",
      used: Boolean(normalized.summary),
      query,
      summary: normalized.summary,
      sources: normalized.sources,
      latencyMs: Date.now() - lookupStart,
    };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Tavily lookup failed for ${agentName}:`, error.message);
    return {
      status: "error",
      used: false,
      query,
      summary: "",
      sources: [],
      latencyMs: Date.now() - lookupStart,
      error: error.message,
    };
  }
}

export function setupTavilyRoutes(app) {
  app.post("/api/tools/tavily-search", async (req, res) => {
    try {
      const { query, context = "", roleDescription = "", maxResults = DEFAULT_MAX_RESULTS } = req.body || {};

      if (!normalizeText(query)) {
        return res.status(400).json({ error: "Missing required field: query" });
      }

      const result = await tavilyInsuranceLookup({
        message: query,
        context,
        roleDescription,
        agentName: "api-diagnostic",
        maxResults,
      });

      return res.json({
        status: result.status,
        summary: result.summary,
        sources: result.sources,
        latencyMs: result.latencyMs,
      });
    } catch (error) {
      console.error("Tavily route error:", error.message);
      return res.status(500).json({ error: "Tavily search failed" });
    }
  });
}