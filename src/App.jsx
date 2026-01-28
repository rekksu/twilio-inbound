import React, { useEffect, useRef, useState } from "react";
import { Device } from "@twilio/voice-sdk";

const TOKEN_URL =
  "https://us-central1-vertexifycx-orbit.cloudfunctions.net/getVoiceToken";

export default function InboundAgent() {
  const deviceRef = useRef(null);
  const callRef = useRef(null);

  const [status, setStatus] = useState("Initializing phone...");
  const [incoming, setIncoming] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  // 🔁 Auto-init Twilio device on page load
  useEffect(() => {
    startDevice();

    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
    };
  }, []);

  // 🔓 Unlock audio on first user click anywhere
  useEffect(() => {
    const unlockAudio = async () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        await ctx.resume();
        setAudioEnabled(true);
        setStatus("🔊 Audio enabled - incoming calls will ring!");
        document.removeEventListener("click", unlockAudio);
      } catch (e) {
        console.error("Audio unlock failed", e);
      }
    };

    document.addEventListener("click", unlockAudio);
    return () => document.removeEventListener("click", unlockAudio);
  }, []);

  const startDevice = async () => {
    if (deviceRef.current) return;

    try {
      const res = await fetch(`${TOKEN_URL}?identity=agent`);
      const { token } = await res.json();

      const device = new Device(token, {
        enableRingingState: true,
        closeProtection: true,
      });

      deviceRef.current = device;

      device.on("registered", () => {
        setStatus("✅ Phone ready (waiting for calls)");
      });

      device.on("incoming", (call) => {
        callRef.current = call;
        setIncoming(true);
        setStatus("📞 Incoming call...");

        call.on("disconnect", () => {
          setIncoming(false);
          setStatus("📴 Call ended");
        });

        call.on("error", (err) => {
          console.error("Call error:", err);
          setIncoming(false);
          setStatus("❌ Call error");
        });
      });

      device.on("error", (err) => {
        console.error("Device error:", err);
        setStatus("❌ Device error: " + err.message);
      });

      await device.register();

      // 🔊 Setup default devices for ringing
      device.audio.setRingtoneDevice("default");
      device.audio.setSpeakerDevices(["default"]);

    } catch (err) {
      console.error(err);
      setStatus("❌ Failed to initialize phone");
    }
  };

  const acceptCall = () => {
    if (!audioEnabled) {
      setStatus("⚠️ Click anywhere to enable audio first!");
      return;
    }
    if (callRef.current) {
      callRef.current.accept();
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

        {!audioEnabled && (
          <div style={{ marginTop: 15, fontSize: 14, color: "#555" }}>
            ⚠️ Click anywhere to enable audio for incoming calls
          </div>
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
    width: 360,
    minHeight: 260,
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
  title: {
    marginBottom: 15,
  },
  status: {
    padding: 10,
    borderRadius: 8,
    background: "#e0e0e0",
    fontWeight: "bold",
    width: "100%",
    marginBottom: 15,
  },
  incomingContainer: {
    display: "flex",
    gap: "15px",
    marginTop: 10,
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
