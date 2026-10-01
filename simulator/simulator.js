const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mqtt = require("mqtt");

const configPath = path.join(__dirname, "..", "config", "farms.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const MQTT_URL = process.env.MQTT_URL || null;
const FAULT_MODE = process.env.FAULT_MODE || "none";

const feedGramsPerBird = {
  1: 12, 2: 16, 3: 20, 4: 24, 5: 27, 6: 31, 7: 35,
  8: 39, 9: 44, 10: 48, 11: 52, 12: 57, 13: 62, 14: 67,
  15: 72, 16: 77, 17: 83, 18: 88, 19: 94, 20: 100,
  21: 105, 22: 111, 23: 117, 24: 122, 25: 128, 26: 134,
  27: 139, 28: 145, 29: 150, 30: 156, 31: 161, 32: 166,
  33: 171, 34: 176, 35: 180, 36: 185, 37: 189, 38: 193,
  39: 197, 40: 201
};

const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, value));

const randomBetween = (min, max) =>
  Math.random() * (max - min) + min;

let mqttClient = null;

if (MQTT_URL) {
  mqttClient = mqtt.connect(MQTT_URL);

  mqttClient.on("connect", () => {
    console.log(`[MQTT] Connected to ${MQTT_URL}`);
  });

  mqttClient.on("error", (err) => {
    console.error("[MQTT ERROR]", err.message);
  });
}

const states = new Map();

for (const farm of config.farms) {
  for (const shed of farm.sheds) {
    states.set(`${farm.farmId}/${shed.shedId}`, {
      temperature: randomBetween(26, 29),
      humidity: randomBetween(55, 65),
      ammonia: randomBetween(8, 15),
      feedWeightKg: shed.feedStartKg,
      waterLevelPercent: shed.waterStartPercent,
      sequenceNumber: 0
    });
  }
}

function publishEvent(farm, shed, sensorType, value, unit) {
  const key = `${farm.farmId}/${shed.shedId}`;
  const state = states.get(key);

  state.sequenceNumber += 1;

  const event = {
    eventId: crypto.randomUUID(),
    farmId: farm.farmId,
    shedId: shed.shedId,
    deviceId: `${shed.shedId}-${sensorType}`,
    sensorType,
    value:
      typeof value === "number"
        ? Number(value.toFixed(2))
        : value,
    unit,
    recordedAt: new Date().toISOString(),
    sequenceNumber: state.sequenceNumber
  };

  const topic =
    `poultryguard/${farm.farmId}/${shed.shedId}/telemetry/${sensorType}`;

  console.log(`[SIM] ${topic}`);
  console.log(JSON.stringify(event));

  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(topic, JSON.stringify(event), {
      qos: 1
    });
  }
}

function emitEnvironmentalReadings() {
  for (const farm of config.farms) {
    for (const shed of farm.sheds) {
      const key = `${farm.farmId}/${shed.shedId}`;
      const state = states.get(key);

      state.temperature = clamp(
        state.temperature + randomBetween(-0.3, 0.3),
        24,
        32
      );

      state.humidity = clamp(
        state.humidity + randomBetween(-1, 1),
        50,
        70
      );

      let temperature = state.temperature;
      let humidity = state.humidity;

      if (FAULT_MODE === "high-temp") {
        temperature = randomBetween(34, 38);
      }

      if (FAULT_MODE === "high-humidity") {
        humidity = randomBetween(78, 90);
      }

      publishEvent(
        farm,
        shed,
        "temperature",
        temperature,
        "C"
      );

      publishEvent(
        farm,
        shed,
        "humidity",
        humidity,
        "%"
      );
    }
  }
}

function emitSlowReadings() {
  for (const farm of config.farms) {
    for (const shed of farm.sheds) {
      const key = `${farm.farmId}/${shed.shedId}`;
      const state = states.get(key);

      state.ammonia = clamp(
        state.ammonia + randomBetween(-0.5, 0.5),
        5,
        20
      );

      let ammonia = state.ammonia;

      if (FAULT_MODE === "high-ammonia") {
        ammonia = randomBetween(28, 40);
      }

      const age = clamp(shed.birdAgeDays, 1, 40);
      const gramsPerBird = feedGramsPerBird[age];

      const dailyFeedKg =
        (shed.livingBirds * gramsPerBird) / 1000;

      const feedConsumedPer10Seconds =
        dailyFeedKg / 8640;

      state.feedWeightKg = Math.max(
        0,
        state.feedWeightKg - feedConsumedPer10Seconds
      );

      let feedWeight = state.feedWeightKg;

      if (FAULT_MODE === "low-feed") {
        feedWeight = shed.feedCapacityKg * 0.1;
      }

      const feedLevelPercent =
        (feedWeight / shed.feedCapacityKg) * 100;

      state.waterLevelPercent = Math.max(
        0,
        state.waterLevelPercent - 0.05
      );

      let waterLevel = state.waterLevelPercent;

      if (FAULT_MODE === "low-water") {
        waterLevel = 10;
      }

      publishEvent(
        farm,
        shed,
        "ammonia",
        ammonia,
        "ppm"
      );

      publishEvent(
        farm,
        shed,
        "feedWeight",
        feedWeight,
        "kg"
      );

      publishEvent(
        farm,
        shed,
        "feedLevel",
        feedLevelPercent,
        "%"
      );

      publishEvent(
        farm,
        shed,
        "waterLevel",
        waterLevel,
        "%"
      );

      if (FAULT_MODE !== "offline") {
        publishEvent(
          farm,
          shed,
          "heartbeat",
          "online",
          "status"
        );
      }
    }
  }
}

console.log("========================================");
console.log(" PoultryGuard Digital Sensor Simulator");
console.log("========================================");
console.log(`Farms configured: ${config.farms.length}`);
console.log(`Fault mode: ${FAULT_MODE}`);
console.log(
  `MQTT mode: ${MQTT_URL ? MQTT_URL : "console-only"}`
);
console.log("----------------------------------------");

emitEnvironmentalReadings();
emitSlowReadings();

setInterval(emitEnvironmentalReadings, 5000);
setInterval(emitSlowReadings, 10000);
