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
  const hasSavedRef = useRef(false); // 🔐 prevent double save

  const [status, setStatus] = useState("Initializing phone…");
  const [incoming, setIncoming] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [orgId, setOrgId] = useState(null);

  /* -------------------- URL FIX -------------------- */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOrgId(params.get("orgId")); // ✅ read once
  }, []);

  /* -------------------- MIC + AUDIO -------------------- */
  const initAudio = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());

    const audio = new Audio();
    audio.autoplay = true;
    audioRef.current = audio;
  };

  /* -------------------- TIMER -------------------- */
  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  /* -------------------- SAVE CALL (SINGLE) -------------------- */
  const saveCallLog = async (statusStr, reason, from, start, end) => {
    if (hasSavedRef.current) return; // ⛔ prevent duplicates
    hasSavedRef.current = true;

    const duration =
      start && end ? Math.floor((end - start) / 1000) : 0;

    await fetch(CALL_LOG_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: from,
        status: statusStr,
        reason,
        startedAt: start,
        endedAt: end,
        durationSeconds: duration,
        orgId,
      }),
    });
  };

  /* -------------------- INIT DEVICE -------------------- */
  useEffect(() => {
    const init = async () => {
      await initAudio();

      const res = await fetch(`${TOKEN_URL}?identity=agent`);
      const { token } = await res.json();

      const device = new Device(token, {
        enableRingingState: true,
        closeProtection: true,
      });

      deviceRef.current = device;
      device.audio.incoming(audioRef.current);

      device.on("error", (e) => {
        console.error(e);
        setStatus("❌ Device error");
      });

      device.on("incoming", (call) => {
        hasSavedRef.current = false; // 🔄 reset per call
        callRef.current = call;
        setIncoming(true);
        setStatus(`📞 Incoming call`);

        call.on("disconnect", () => {
          stopTimer();
          saveCallLog(
            "ended",
            null,
            call.parameters.From,
            startedAtRef.current,
            Date.now()
          );
          setIncoming(false);
          setStatus("📴 Call ended");
        });

        call.on("error", () => {
          stopTimer();
          setIncoming(false);
          setStatus("❌ Call error");
        });
      });

      await device.register();
      setStatus("✅ Ready – waiting for calls");
    };

    init();
  }, []);

  /* -------------------- ACTIONS -------------------- */
  const acceptCall = () => {
    callRef.current.accept();
    startedAtRef.current = Date.now();
    startTimer();
    setIncoming(false);
    setStatus("✅ Connected");
  };

  const rejectCall = () => {
    saveCallLog(
      "rejected",
      "Agent rejected",
      callRef.current.parameters.From,
      null,
      Date.now()
    );
    callRef.current.reject();
    setIncoming(false);
    setStatus("❌ Call rejected");
  };

  /* -------------------- UI -------------------- */
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>📞 Inbound Agent</h2>
        <div style={styles.status}>{status}</div>

        {incoming && (
          <div style={styles.actions}>
            <button style={styles.accept} onClick={acceptCall}>
              Accept
            </button>
            <button style={styles.reject} onClick={rejectCall}>
              Reject
            </button>
          </div>
        )}

        {startedAtRef.current && (
          <p style={{ fontWeight: "bold" }}>⏱ {callDuration}s</p>
        )}
      </div>
    </div>
  );
}

/* -------------------- STYLES -------------------- */
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
    width: 360,
    padding: 30,
    borderRadius: 12,
    background: "#fff",
    boxShadow: "0 6px 20px rgba(0,0,0,.15)",
    textAlign: "center",
  },
  status: {
    padding: 10,
    borderRadius: 8,
    background: "#e0e0e0",
    fontWeight: "bold",
    marginBottom: 15,
  },
  actions: {
    display: "flex",
    justifyContent: "center",
    gap: 15,
  },
  accept: {
    background: "#2e7d32",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
  },
  reject: {
    background: "#d32f2f",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
  },
};
