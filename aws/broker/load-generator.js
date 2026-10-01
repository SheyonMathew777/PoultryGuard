const mqtt = require("mqtt");
const crypto = require("crypto");

const BROKER = process.env.MQTT_URL || "mqtt://localhost:1883";
const RATE = Number(process.env.RATE || 100);
const DURATION = Number(process.env.DURATION || 30);

const client = mqtt.connect(BROKER);
let sent = 0;
let sequence = 0;

client.on("connect", () => {
  console.log("================================");
  console.log(" PoultryGuard Load Generator");
  console.log("================================");
  console.log(`[TARGET] ${RATE} msg/s for ${DURATION}s`);

  const start = Date.now();
  const intervalMs = 100;
  const perInterval = Math.max(1, Math.round(RATE / 10));

  const timer = setInterval(() => {
    for (let i = 0; i < perInterval; i++) {
      sequence++;

      const shed = sequence % 2 === 0 ? "shed-01" : "shed-02";

      const message = {
        eventId: crypto.randomUUID(),
        farmId: "farm-01",
        shedId: shed,
        deviceId: `${shed}-temperature`,
        sensorType: "temperature",
        value: 27 + Math.random() * 3,
        unit: "C",
        recordedAt: new Date().toISOString(),
        sequenceNumber: sequence
      };

      client.publish(
        `poultryguard/farm-01/${shed}/telemetry/temperature`,
        JSON.stringify(message),
        { qos: 0 }
      );

      sent++;
    }

    if (Date.now() - start >= DURATION * 1000) {
      clearInterval(timer);

      setTimeout(() => {
        const elapsed = (Date.now() - start) / 1000;
        console.log(`[DONE] Sent ${sent} messages`);
        console.log(`[ACTUAL] ${(sent / elapsed).toFixed(2)} msg/s`);
        client.end();
      }, 500);
    }
  }, intervalMs);
});
