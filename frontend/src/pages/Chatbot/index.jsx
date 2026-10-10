
import React, { useState, useRef, useEffect } from "react";
import "./index.css";
import { BsFillArrowUpCircleFill } from "react-icons/bs";
import ReactMarkdown from "react-markdown";
import gfm from "remark-gfm";

const Chatbot = ({ ml }) => {
  const welcomeMessage = {
    sender: "bot",
    message:
      "Hello! 👋 I'm your HealthAI assistant. I can help you understand health topics, medical terminology, wellness and general healthcare information.\n\nWhat would you like to know today?",
  };

  const [chats, setChats] = useState([welcomeMessage]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const endOfMessagesRef = useRef(null);
  const inputRef = useRef(null);

  const sidebarWidth = ml === 14 ? "56px" : "256px";

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [chats, loading]);

  const handleNewChat = () => {
    setChats([welcomeMessage]);
    setInputMessage("");
    inputRef.current?.focus();
  };

  const handleSendMessage = async (text = inputMessage) => {
    const prompt = text.trim();

    if (!prompt || loading) return;

    setChats((prev) => [
      ...prev,
      {
        sender: "user",
        message: prompt,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);

    setInputMessage("");
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:5000/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || "Request failed");
      }

      setChats((prev) => [
        ...prev,
        {
          sender: "bot",
          message: result.output || "I couldn't generate a response. Please try again.",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } catch (error) {
      console.error("Chatbot error:", error);

      setChats((prev) => [
        ...prev,
        {
          sender: "bot",
          message: `Sorry, I couldn't process that message.\n\n${error.message || "Please check that the backend is running and try again."}`,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const suggestions = [
    {
      icon: "🩺",
      title: "Understand medical terms",
      subtitle: "Explain common medical terminology",
      prompt: "Explain some common medical terms in simple language.",
    },
    {
      icon: "🥗",
      title: "Healthy lifestyle",
      subtitle: "Explore everyday wellness habits",
      prompt: "Give me some general tips for a healthy lifestyle.",
    },
    {
      icon: "🩸",
      title: "Blood test basics",
      subtitle: "Learn what common tests measure",
      prompt: "Explain common blood tests and what they measure.",
    },
    {
      icon: "💧",
      title: "Daily hydration",
      subtitle: "Learn about staying hydrated",
      prompt: "Why is hydration important for health?",
    },
  ];

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div
      className="hai-chat-app"
      style={{ "--hai-sidebar-width": sidebarWidth }}
    >
      <header className="hai-chat-header">
        <div className="hai-brand">
          <div className="hai-brand-icon">✚</div>
          <div>
            <h2>HealthAI</h2>
            <span>Healthcare assistant</span>
          </div>
        </div>

        <button
          type="button"
          className="hai-new-chat"
          onClick={handleNewChat}
          title="Start a new chat"
        >
          <span>＋</span> <span>New chat</span>
        </button>
      </header>

      <main className="hai-chat-main">
        {chats.length === 1 ? (
          <section className="hai-welcome">
            <div className="hai-welcome-symbol">✚</div>

            <h1>What can I help with?</h1>

            <p>
              Your AI healthcare companion for understanding health
              information and everyday wellness.
            </p>

            <div className="hai-suggestions">
              {suggestions.map((item) => (
                <button
                  type="button"
                  className="hai-suggestion"
                  key={item.title}
                  onClick={() => handleSendMessage(item.prompt)}
                  disabled={loading}
                >
                  <span className="hai-suggestion-icon">{item.icon}</span>
                  <span className="hai-suggestion-copy">
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                  <span className="hai-suggestion-arrow">↗</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="hai-messages">
            {chats.slice(1).map((chat, index) => (
              <article
                className={`hai-message-row ${
                  chat.sender === "user" ? "hai-user-row" : "hai-bot-row"
                }`}
                key={`${index}-${chat.timestamp || ""}`}
              >
                {chat.sender === "bot" && (
                  <div className="hai-avatar">✚</div>
                )}

                <div
                  className={`hai-message-content ${
                    chat.sender === "user"
                      ? "hai-user-message"
                      : "hai-bot-message"
                  } ${chat.isError ? "hai-error-message" : ""}`}
                >
                  {chat.sender === "bot" && (
                    <div className="hai-message-label">HealthAI</div>
                  )}

                  <div className="hai-markdown">
                    <ReactMarkdown remarkPlugins={[gfm]}>
                      {chat.message}
                    </ReactMarkdown>
                  </div>

                  {chat.timestamp && (
                    <span className="hai-message-time">{chat.timestamp}</span>
                  )}
                </div>
              </article>
            ))}

            {loading && (
              <div className="hai-message-row hai-bot-row">
                <div className="hai-avatar">✚</div>
                <div className="hai-typing">
                  <span />
                  <span />
                  <span />
                  <small>HealthAI is thinking</small>
                </div>
              </div>
            )}

            <div ref={endOfMessagesRef} />
          </section>
        )}

        <footer className="hai-composer-area">
          <form
            className="hai-composer"
            onSubmit={(event) => {
              event.preventDefault();
              handleSendMessage();
            }}
          >
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(event) => setInputMessage(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message HealthAI..."
              rows={1}
              aria-label="Message HealthAI"
              disabled={loading}
            />

            <div className="hai-composer-bottom">
              <span className="hai-composer-hint">
                <span className="hai-status-dot" />
                Healthcare assistant
              </span>

              <button
                type="submit"
                className="hai-send-button"
                disabled={!inputMessage.trim() || loading}
                aria-label="Send message"
                title="Send message"
              >
                <BsFillArrowUpCircleFill size={34} />
              </button>
            </div>
          </form>

          <p className="hai-disclaimer">
            HealthAI can make mistakes. For medical concerns, consult a
            qualified healthcare professional.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Chatbot;
