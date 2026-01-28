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
  const startedAtRef = useRef(null);
  const savedRef = useRef(false);
  const orgIdRef = useRef(null);

  const [status, setStatus] = useState("Initializing…");
  const [incoming, setIncoming] = useState(false);
  const [duration, setDuration] = useState(0);

  /* ---------------- ORG ID ---------------- */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    orgIdRef.current = params.get("orgId");
    console.log("ORG ID:", orgIdRef.current);
  }, []);

  /* ---------------- MUTED AUTOPLAY HACK ---------------- */
  useEffect(() => {
    // Play a silent muted audio to allow autoplay for Twilio ringing
    const silentAudio = new Audio();
    silentAudio.muted = true;
    silentAudio.play().catch(() => {});
  }, []);

  /* ---------------- TIMER ---------------- */
  useEffect(() => {
    let timer;
    if (startedAtRef.current) {
      timer = setInterval(() => {
        setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [startedAtRef.current]);

  /* ---------------- SAVE CALL ---------------- */
  const saveCall = async (status, reason, from, start, end) => {
    if (savedRef.current) return;
    savedRef.current = true;

    await fetch(CALL_LOG_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: from,
        status,
        reason,
        direction: "inbound",
        startedAt: start ? new Date(start).toISOString() : null,
        endedAt: end ? new Date(end).toISOString() : null,
        durationSeconds: start && end ? Math.floor((end - start) / 1000) : 0,
        orgId: orgIdRef.current,
      }),
    });
  };

  /* ---------------- INIT DEVICE ---------------- */
  useEffect(() => {
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());

        const audioEl = new Audio();
        audioEl.autoplay = true;
        audioRef.current = audioEl;

        const res = await fetch(`${TOKEN_URL}?identity=agent`);
        const { token } = await res.json();

        const device = new Device(token, {
          enableRingingState: true,
          closeProtection: true,
        });

        deviceRef.current = device;
        device.audio.incoming(audioRef.current);

        device.on("incoming", (call) => {
          savedRef.current = false;
          callRef.current = call;
          setIncoming(true);
          setStatus("📞 Incoming call");

          call.on("disconnect", () => {
            saveCall(
              "ended",
              null,
              call.parameters.From,
              startedAtRef.current,
              Date.now()
            );
            startedAtRef.current = null;
            setIncoming(false);
            setStatus("📴 Call ended");
          });

          call.on("error", (err) => {
            saveCall(
              "failed",
              err.message,
              call.parameters.From,
              startedAtRef.current,
              Date.now()
            );
          });
        });

        await device.register();
        setStatus("✅ Ready for inbound calls");
      } catch (err) {
        console.error(err);
        setStatus("❌ Init failed");
      }
    };

    init();
  }, []);

  /* ---------------- ACTIONS ---------------- */
  const acceptCall = () => {
    startedAtRef.current = Date.now();
    callRef.current.accept();
    setIncoming(false);
    setStatus("✅ Connected");
  };

  const rejectCall = () => {
    saveCall(
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

  /* ---------------- UI ---------------- */
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>📞 Inbound Agent</h2>

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

        {startedAtRef.current && <p style={styles.timer}>⏱ {duration}s</p>}
      </div>
    </div>
  );
}

/* ---------------- STYLES ---------------- */
const styles = {
  container: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f0f2f5",
  },
  card: {
    width: 360,
    padding: 30,
    borderRadius: 14,
    background: "#fff",
    boxShadow: "0 8px 24px rgba(0,0,0,.15)",
    textAlign: "center",
  },
  title: { marginBottom: 12 },
  status: {
    padding: 12,
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
    border: "none",
    borderRadius: 8,
    fontWeight: "bold",
    cursor: "pointer",
  },
  reject: {
    background: "#d32f2f",
    color: "#fff",
    padding: "10px 20px",
    border: "none",
    borderRadius: 8,
    fontWeight: "bold",
    cursor: "pointer",
  },
  timer: {
    marginTop: 12,
    fontWeight: "bold",
  },
};
