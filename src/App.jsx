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
  const hasSavedRef = useRef(false);
  const orgIdRef = useRef(null); // ✅ FIX

  const [status, setStatus] = useState("Initializing…");
  const [incoming, setIncoming] = useState(false);
  const [duration, setDuration] = useState(0);

  /* ---------- READ ORG ID ---------- */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    orgIdRef.current = params.get("orgId");
    console.log("ORG ID:", orgIdRef.current);
  }, []);

  /* ---------- AUDIO ---------- */
  const initAudio = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());

    const audio = new Audio();
    audio.autoplay = true;
    audioRef.current = audio;
  };

  /* ---------- TIMER ---------- */
  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
  };

  const stopTimer = () => {
    clearInterval(timerRef.current);
  };

  /* ---------- SAVE CALL ---------- */
  const saveCallLog = async (statusStr, reason, from, start, end) => {
    if (hasSavedRef.current) return;
    hasSavedRef.current = true;

    await fetch(CALL_LOG_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: from,
        status: statusStr,
        reason,
        startedAt: start,
        endedAt: end,
        durationSeconds:
          start && end ? Math.floor((end - start) / 1000) : 0,
        orgId: orgIdRef.current, // ✅ ALWAYS PRESENT
      }),
    });
  };

  /* ---------- INIT DEVICE ---------- */
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

      device.on("incoming", (call) => {
        hasSavedRef.current = false;
        callRef.current = call;
        setIncoming(true);
        setStatus("📞 Incoming call");

        call.on("disconnect", () => {
          stopTimer();
          saveCallLog(
            "ended",
            null,
            call.parameters.From,
            startedAtRef.current,
            Date.now()
          );
          setStatus("📴 Call ended");
        });
      });

      await device.register();
      setStatus("✅ Ready");
    };

    init();
  }, []);

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
    setStatus("❌ Rejected");
  };

  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
      <div style={{ padding: 30, background: "#fff", borderRadius: 12 }}>
        <h3>Inbound Agent</h3>
        <p>{status}</p>

        {incoming && (
          <>
            <button onClick={acceptCall}>Accept</button>
            <button onClick={rejectCall}>Reject</button>
          </>
        )}

        {startedAtRef.current && <p>⏱ {duration}s</p>}
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
