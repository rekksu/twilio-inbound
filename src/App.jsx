import React, { useEffect, useRef, useState } from "react";
import { Device } from "@twilio/voice-sdk";

const TOKEN_URL =
  "https://us-central1-vertexifycx-orbit.cloudfunctions.net/getVoiceToken";

export default function InboundAgent() {
  const deviceRef = useRef(null);
  const callRef = useRef(null);

  const [status, setStatus] = useState("Initializing...");
  const [incoming, setIncoming] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const startDevice = async () => {
    try {
      setStatus("Initializing phone...");

      // 🔊 Audio context (may fail without user gesture)
      const audioContext =
        new (window.AudioContext || window.webkitAudioContext)();

      if (audioContext.state !== "running") {
        await audioContext.resume();
      }

      const res = await fetch(`${TOKEN_URL}?identity=agent`);
      const { token } = await res.json();

      const device = new Device(token, {
        enableRingingState: true,
        closeProtection: true,
      });

      deviceRef.current = device;

      device.on("error", (err) => {
        console.error("Device error:", err);
        setStatus("❌ Device error: " + err.message);
      });

      setStatus("Registering device...");
      await device.register();

      setStatus("✅ Phone ready");

      device.on("incoming", (call) => {
        callRef.current = call;
        setIncoming(true);
        setStatus("📞 Incoming call...");

        call.on("disconnect", () => {
          setIncoming(false);
          setStatus("📴 Call ended");
        });

        call.on("error", () => {
          setIncoming(false);
          setStatus("❌ Call error");
        });
      });
    } catch (err) {
      console.error(err);
      setAudioBlocked(true);
      setStatus("🔊 Tap to enable audio");
    }
  };

  // 🚀 AUTO-START ON PAGE LOAD
  useEffect(() => {
    startDevice();
  }, []);

  const acceptCall = () => {
    callRef.current?.accept();
    setIncoming(false);
    setStatus("✅ Call connected");
  };

  const rejectCall = () => {
    callRef.current?.reject();
    setIncoming(false);
    setStatus("❌ Call rejected");
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>📞 Inbound Agent</h2>

        <div style={styles.status}>{status}</div>

        {/* 🔊 Audio permission fallback */}
        {audioBlocked && (
          <button style={styles.startButton} onClick={startDevice}>
            Enable Audio
          </button>
        )}

        {incoming && (
          <div style={styles.incomingContainer}>
            <button style={styles.acceptButton} onClick={acceptCall}>
              Accept
            </button>
            <button style={styles.rejectButton} onClick={rejectCall}>
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
