const mqtt = require("mqtt");
const os = require("os");

const BROKER_URL = process.env.MQTT_URL || "mqtt://172.31.23.126:1883";
const WORKER_ID = process.env.WORKER_ID || os.hostname();
const GROUP = process.env.WORKER_GROUP || "poultryguard-workers";
const TOPIC = `$share/${GROUP}/poultryguard/+/+/telemetry/#`;

const REQUIRED = [
  "eventId",
  "farmId",
  "shedId",
  "deviceId",
  "sensorType",
  "value",
  "unit",
  "recordedAt",
  "sequenceNumber"
];

let received = 0;
let processed = 0;
let invalid = 0;
let intervalProcessed = 0;
let latencies = [];
let lastReport = Date.now();

const client = mqtt.connect(BROKER_URL, {
  clean: true,
  reconnectPeriod: 1000
});

client.on("connect", () => {
  console.log("==========================================");
  console.log(" PoultryGuard Telemetry Processing Worker");
  console.log("==========================================");
  console.log(`[WORKER] ${WORKER_ID}`);
  console.log(`[MQTT] Connected to ${BROKER_URL}`);
  console.log(`[MQTT] Shared subscription: ${TOPIC}`);

  client.subscribe(TOPIC, { qos: 1 }, err => {
    if (err) {
      console.error("[ERROR] Subscribe failed:", err.message);
      process.exit(1);
    }
    console.log("[READY] Waiting for telemetry...");
  });
});

client.on("message", (topic, payload) => {
  received++;

  try {
    const msg = JSON.parse(payload.toString());

    const missing = REQUIRED.filter(
      field => msg[field] === undefined || msg[field] === null
    );

    if (missing.length > 0) {
      invalid++;
      return;
    }

    const recorded = Date.parse(msg.recordedAt);

    if (Number.isNaN(recorded)) {
      invalid++;
      return;
    }

    const latency = Math.max(0, Date.now() - recorded);

    latencies.push(latency);
    processed++;
    intervalProcessed++;
  } catch {
    invalid++;
  }
});

setInterval(() => {
  const now = Date.now();
  const seconds = (now - lastReport) / 1000;
  const rate = intervalProcessed / seconds;

  const sorted = [...latencies].sort((a, b) => a - b);

  const avg =
    sorted.length > 0
      ? sorted.reduce((a, b) => a + b, 0) / sorted.length
      : 0;

  const p95 =
    sorted.length > 0
      ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
      : 0;

  console.log(
    `[METRIC] worker=${WORKER_ID}` +
    ` rate=${rate.toFixed(2)} msg/s` +
    ` processed=${processed}` +
    ` invalid=${invalid}` +
    ` avgLatency=${avg.toFixed(1)}ms` +
    ` p95Latency=${p95.toFixed(1)}ms`
  );

  intervalProcessed = 0;
  latencies = [];
  lastReport = now;
}, 5000);

client.on("error", err => {
  console.error("[MQTT ERROR]", err.message);
});
