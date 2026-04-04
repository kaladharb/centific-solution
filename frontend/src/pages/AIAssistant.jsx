import { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Badge from "../components/UI/Badge";
import LoadingSpinner from "../components/UI/LoadingSpinner";

const starterPrompts = [
  "What are the top selling products this week?",
  "Which items are running low on stock?",
  "Show me today's sales summary",
  "Are there any suspicious transactions?",
  "Which products should I restock urgently?",
];

function AIAssistant() {
  const { user } = useAuth();
  const locationId = user?.location_id || 1;
  const [chatMessages, setChatMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [loadingAnomalies, setLoadingAnomalies] = useState(false);
  const messagesEndRef = useRef(null);

  // Initialize with welcome message
  useEffect(() => {
    setChatMessages([
      {
        role: "ai",
        content: `👋 Hi ${user?.username || "there"}! I'm your VoltEdge AI assistant. I can help you analyze inventory, sales trends, and spot operational patterns. What would you like to know?`,
        timestamp: new Date(),
      },
    ]);
  }, [user?.username]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendMessage = async (message = inputValue) => {
    if (!message.trim()) return;

    const userMessage = {
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setAiThinking(true);
    setError("");

    try {
      const response = await api.post("/api/ai/query", {
        query: message,
        location_id: locationId,
        context: {
          role: user?.role,
          timestamp: new Date().toISOString(),
        },
      });

      const aiMessage = {
        role: "ai",
        content:
          response.data.response ||
          "I couldn't generate a response. Please try again.",
        timestamp: new Date(),
      };

      setChatMessages((prev) => [...prev, aiMessage]);
    } catch (fetchError) {
      console.error(fetchError);
      const errorMessage = {
        role: "ai",
        content: `Sorry, I encountered an error: ${fetchError.response?.data?.message || "Unable to process your query. Please try again."} ❌`,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setAiThinking(false);
    }
  };

  const handleRecommendations = async () => {
    setLoadingRecs(true);
    setError("");
    try {
      const response = await api.get(`/api/ai/recommendations/${locationId}`);
      const data = response.data;
      const recs = Array.isArray(data)
        ? data
        : Array.isArray(data?.recommendations)
          ? data.recommendations
          : [];
      setRecommendations(recs);
      if (data?.error) {
        setError(data.error);
      }
      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content:
            "Here are my restock recommendations based on current inventory levels and sales trends:",
          timestamp: new Date(),
        },
      ]);
    } catch (fetchError) {
      console.error(fetchError);
      setError(
        fetchError.response?.data?.error ||
          fetchError.response?.data?.message ||
          "Failed to fetch recommendations",
      );
    } finally {
      setLoadingRecs(false);
    }
  };

  const handleAnomalies = async () => {
    setLoadingAnomalies(true);
    setError("");
    try {
      const response = await api.get(
        `/api/ai/anomalies?location_id=${locationId}`,
      );
      const data = response.data;
      const anomaliesData = Array.isArray(data)
        ? data
        : Array.isArray(data?.anomalies)
          ? data.anomalies
          : [];
      setAnomalies(anomaliesData);
      if (data?.error) {
        setError(data.error);
      }
      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content:
            "I've scanned your recent transactions and found the following anomalies:",
          timestamp: new Date(),
        },
      ]);
    } catch (fetchError) {
      console.error(fetchError);
      setError(
        fetchError.response?.data?.error ||
          fetchError.response?.data?.message ||
          "Failed to fetch anomalies",
      );
    } finally {
      setLoadingAnomalies(false);
    }
  };

  const hasStarterPrompts = chatMessages.length <= 1;

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-slate-50">
      {/* Quick Actions */}
      <div className="space-y-4 border-b border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-2xl">📦</div>
            <h3 className="mt-2 font-semibold text-slate-900">
              Restock Recommendations
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              AI-powered inventory suggestions
            </p>
            <button
              type="button"
              onClick={handleRecommendations}
              disabled={loadingRecs}
              className="mt-3 rounded-3xl bg-[#1B3A6B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#153057] disabled:opacity-50"
            >
              {loadingRecs ? "Analyzing..." : "Analyze Now"}
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-2xl">🔍</div>
            <h3 className="mt-2 font-semibold text-slate-900">
              Anomaly Detection
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Detect suspicious patterns
            </p>
            <button
              type="button"
              onClick={handleAnomalies}
              disabled={loadingAnomalies}
              className="mt-3 rounded-3xl bg-[#1B3A6B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#153057] disabled:opacity-50"
            >
              {loadingAnomalies ? "Scanning..." : "Scan Now"}
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-2xl">📊</div>
            <h3 className="mt-2 font-semibold text-slate-900">Smart Reports</h3>
            <p className="mt-1 text-sm text-slate-600">
              Ask anything about your data
            </p>
            <button
              type="button"
              onClick={() =>
                handleSendMessage(
                  "What are my top 3 selling products this week?",
                )
              }
              className="mt-3 rounded-3xl bg-[#1B3A6B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#153057]"
            >
              Try a Query
            </button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {chatMessages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {msg.role === "ai" ? (
              <div className="flex-shrink-0 text-2xl">🤖</div>
            ) : (
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[#1B3A6B]" />
            )}
            <div
              className={`flex-1 rounded-3xl p-4 ${
                msg.role === "user"
                  ? "bg-[#1B3A6B] text-white rounded-br-none"
                  : "bg-white border border-slate-200 text-slate-900 rounded-bl-none"
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Recommendations */}
        {recommendations && recommendations.length > 0 ? (
          <div className="space-y-3">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="rounded-3xl border border-orange-200 bg-orange-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {typeof rec === "string" ? (
                      <p className="text-sm text-slate-900">{rec}</p>
                    ) : (
                      <>
                        <p className="font-semibold text-slate-900">
                          {rec.product_name}
                        </p>
                        <p className="mt-1 text-sm text-slate-600 italic">
                          {rec.reason}
                        </p>
                      </>
                    )}
                  </div>
                  {typeof rec !== "string" ? (
                    <Badge
                      status={
                        rec.urgency === "critical"
                          ? "critical"
                          : rec.urgency === "high"
                            ? "low"
                            : "pending"
                      }
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Anomalies */}
        {anomalies && anomalies.length > 0 ? (
          <div className="space-y-3">
            {anomalies.map((anomaly, idx) => (
              <div
                key={idx}
                className="rounded-3xl border border-red-200 bg-red-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {typeof anomaly === "string" ? (
                      <p className="text-sm text-slate-900">{anomaly}</p>
                    ) : (
                      <>
                        <p className="font-semibold text-slate-900">
                          {anomaly.type}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {anomaly.description}
                        </p>
                        <p className="mt-2 text-xs text-blue-600">
                          Action: {anomaly.suggested_action}
                        </p>
                      </>
                    )}
                  </div>
                  {typeof anomaly !== "string" ? (
                    <Badge status="critical" />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Starter Prompts */}
        {hasStarterPrompts ? (
          <div className="mt-8 flex flex-wrap gap-2">
            {starterPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        {aiThinking ? (
          <div className="flex gap-3">
            <div className="flex-shrink-0 text-2xl">🤖</div>
            <div className="flex items-center gap-1 rounded-3xl bg-white border border-slate-200 p-4 text-slate-600">
              <span>Thinking</span>
              <span className="inline-flex gap-1">
                <span className="h-1 w-1 animate-bounce rounded-full bg-slate-400" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-slate-400 delay-100" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-slate-400 delay-200" />
              </span>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="border-t border-slate-200 bg-white p-6 shadow-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex gap-3"
        >
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about inventory, sales, operations..."
            disabled={aiThinking}
            className="flex-1 rounded-3xl border border-slate-200 bg-slate-50 px-6 py-4 text-sm outline-none focus:border-[#E8500A] focus:ring-4 focus:ring-[#E8500A]/10 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={aiThinking || !inputValue.trim()}
            className="rounded-3xl bg-[#E8500A] px-6 py-4 text-sm font-semibold text-white hover:bg-[#c23e0c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            →
          </button>
        </form>
      </div>
    </div>
  );
}

export default AIAssistant;
