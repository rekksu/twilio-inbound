import React, { useEffect, useRef, useState } from "react";
import { Device } from "@twilio/voice-sdk";

const TOKEN_URL =
  "https://us-central1-vertexifycx-orbit.cloudfunctions.net/getVoiceToken";
const CALL_LOG_FUNCTION_URL =
  "https://us-central1-vertexifycx-orbit.cloudfunctions.net/createCallLog";

export default function InboundAgent() {
  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const audioRef = useRef(null);
  const [status, setStatus] = useState("Requesting microphone...");
  const [incoming, setIncoming] = useState(false);

  // Save call to backend
  const saveCallLog = async (statusStr, reason, fromNumber, duration, start, end) => {
    try {
      await fetch(CALL_LOG_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromNumber,
          status: statusStr,          // "connected", "ended", "failed"
          reason: reason || null,
          startedAt: start ? new Date(start).toISOString() : null,
          endedAt: end ? new Date(end).toISOString() : null,
          durationSeconds: duration || 0,
        }),
      });
    } catch (err) {
      console.error("Failed to save call log:", err);
    }
  };

  // Request mic and create audio element
  const initAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());

      const audioEl = new Audio();
      audioEl.autoplay = true;
      audioRef.current = audioEl;

      setStatus("✅ Microphone ready");
      return true;
    } catch (err) {
      console.error(err);
      setStatus("❌ Mic permission denied");
      return false;
    }
  };

  const initDevice = async () => {
    const micOk = await initAudio();
    if (!micOk) return;

    try {
      setStatus("Fetching Twilio token...");
      const res = await fetch(`${TOKEN_URL}?identity=agent`);
      const { token } = await res.json();

      const device = new Device(token, { enableRingingState: true, closeProtection: true });
      deviceRef.current = device;

      if (audioRef.current) {
        device.audio.incoming(audioRef.current); // attach audio for call
      }

      device.on("error", (err) => {
        console.error("Device error:", err);
        setStatus("❌ Device error: " + err.message);
      });

      device.on("incoming", (call) => {
        callRef.current = call;
        setIncoming(true);
        setStatus("📞 Incoming call...");

        const startTime = Date.now();

        call.on("accept", () => {
          setStatus("✅ Call connected");
        });

        call.on("disconnect", () => {
          const endTime = Date.now();
          const duration = Math.floor((endTime - startTime) / 1000);
          saveCallLog("ended", null, call.parameters.From, duration, startTime, endTime);
          setIncoming(false);
          setStatus("📴 Call ended");
        });

        call.on("error", (err) => {
          const endTime = Date.now();
          const duration = Math.floor((endTime - startTime) / 1000);
          saveCallLog("failed", err.message, call.parameters.From, duration, startTime, endTime);
          console.error("Call error:", err);
          setIncoming(false);
          setStatus("❌ Call error");
        });
      });

      setStatus("✅ Registering device...");
      await device.register();
      setStatus("✅ Phone ready, waiting for calls...");
    } catch (err) {
      console.error(err);
      setStatus("❌ Failed to initialize phone: " + err.message);
    }
  };

  useEffect(() => {
    initDevice();
  }, []);

  const acceptCall = () => {
    if (callRef.current) {
      callRef.current.accept();
      setIncoming(false);
      setStatus("✅ Call connected");
    }
  };

  const rejectCall = () => {
    if (callRef.current) {
      const startTime = Date.now();
      callRef.current.reject();
      setIncoming(false);
      setStatus("❌ Call rejected");

      // Log rejected call
      saveCallLog("rejected", null, callRef.current.parameters.From, 0, startTime, startTime);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>📞 Inbound Agent</h2>
        <div style={styles.status}>{status}</div>

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

const styles = {
  container: {
    height: "100vh",
    width: "100vw",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f0f2f5",
  },
  card: {
    width: 350,
    minHeight: 250,
    padding: 30,
    borderRadius: 12,
    boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    background: "#fff",
    textAlign: "center",
  },
  title: { marginBottom: 15 },
  status: {
    padding: 10,
    borderRadius: 8,
    background: "#e0e0e0",
    fontWeight: "bold",
    textAlign: "center",
    width: "100%",
    marginBottom: 15,
  },
  incomingContainer: {
    display: "flex",
    justifyContent: "center",
    gap: "15px",
    marginTop: 10,
    flexWrap: "wrap",
  },
  acceptButton: {
    background: "#2e7d32",
    color: "#fff",
    padding: "10px 20px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold",
  },
  rejectButton: {
    background: "#d32f2f",
    color: "#fff",
    padding: "10px 20px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold",
  },
};
