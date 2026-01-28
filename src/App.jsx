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
  const timerRef = useRef(null);
  const startedAtRef = useRef(null);

  const [status, setStatus] = useState("Requesting microphone...");
  const [incoming, setIncoming] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // ---- Request microphone and create audio element ----
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
      setStatus("❌ Microphone permission denied");
      return false;
    }
  };

  // ---- Save call log to Cloud Function ----
  const saveCallLog = async (statusStr, reason, callerNumber, duration, start, end) => {
    try {
      await fetch(CALL_LOG_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: callerNumber,         // Must be 'to' for your cloud function
          status: statusStr,
          reason: reason || null,
          startedAt: start,
          endedAt: end,
          durationSeconds: duration || 0,
          customerId: null,
          orgId: null,
        }),
      });
    } catch (err) {
      console.error("Failed to save call log:", err);
    }
  };

  // ---- Live call timer ----
  const startLiveTimer = () => {
    timerRef.current = setInterval(() => {
      const now = Date.now();
      setCallDuration(Math.floor((now - startedAtRef.current) / 1000));
    }, 1000);
  };

  const stopLiveTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // ---- Initialize Twilio Device ----
  const initDevice = async () => {
    const micOk = await initAudio();
    if (!micOk) return;

    try {
      setStatus("Fetching Twilio token...");
      const res = await fetch(`${TOKEN_URL}?identity=agent`);
      const { token } = await res.json();

      const device = new Device(token, { enableRingingState: true, closeProtection: true });
      deviceRef.current = device;

      // Attach audio element for incoming call
      if (audioRef.current) {
        device.audio.incoming(audioRef.current);
      }

      device.on("error", (err) => {
        console.error("Device error:", err);
        setStatus("❌ Device error: " + err.message);
      });

      device.on("incoming", (call) => {
        callRef.current = call;
        setIncoming(true);
        setStatus(`📞 Incoming call from ${call.parameters.From}`);

        call.on("disconnect", () => {
          stopLiveTimer();
          const end = Date.now();
          const dur = startedAtRef.current ? Math.floor((end - startedAtRef.current) / 1000) : 0;

          saveCallLog("ended", null, call.parameters.From, dur, startedAtRef.current, end);
          setIncoming(false);
          setStatus("📴 Call ended");
        });

        call.on("error", (err) => {
          stopLiveTimer();
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
    initDevice(); // Auto initialize device on mount
  }, []);

  // ---- Accept / Reject incoming call ----
  const acceptCall = () => {
    if (callRef.current) {
      callRef.current.accept();
      startedAtRef.current = Date.now();
      startLiveTimer();
      setIncoming(false);
      setStatus("✅ Call connected");
    }
  };

  const rejectCall = () => {
    if (callRef.current) {
      callRef.current.reject();
      setIncoming(false);
      setStatus("❌ Call rejected");
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

        {startedAtRef.current && (
          <p style={{ marginTop: 10, fontWeight: "bold" }}>
            ⏱ Duration: {callDuration}s
          </p>
        )}
      </div>
    </div>
  );
}

// ---- Styles ----
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
