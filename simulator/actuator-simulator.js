const mqtt = require("mqtt");
const crypto = require("crypto");

const MQTT_URL =
  process.env.MQTT_URL || "mqtt://localhost:1883";

const client = mqtt.connect(MQTT_URL);

const actuatorStates = new Map();

function getState(farmId, shedId) {
  const key = `${farmId}/${shedId}`;

  if (!actuatorStates.has(key)) {
    actuatorStates.set(key, {
      fan: "OFF",
      cooling: "OFF",
      feeder: "OFF",
      pump: "OFF"
    });
  }

  return actuatorStates.get(key);
}

client.on("connect", () => {
  console.log("========================================");
  console.log(" PoultryGuard Virtual Actuator Simulator");
  console.log("========================================");
  console.log(`[MQTT] Connected to ${MQTT_URL}`);

  client.subscribe(
    "poultryguard/+/+/commands",
    { qos: 1 },
    (err) => {
      if (err) {
        console.error(
          "[MQTT] Subscription error:",
          err.message
        );
        return;
      }

      console.log(
        "[MQTT] Listening for actuator commands..."
      );
      console.log("----------------------------------------");
    }
  );
});

client.on("message", (topic, buffer) => {
  try {
    const command = JSON.parse(buffer.toString());

    const {
      farmId,
      shedId,
      reason,
      actions,
      createdAt
    } = command;

    if (
      !farmId ||
      !shedId ||
      !Array.isArray(actions)
    ) {
      console.log(
        "[ACTUATOR] Invalid command ignored"
      );
      return;
    }

    const state = getState(farmId, shedId);

    console.log(
      `\n[COMMAND] ${farmId}/${shedId} - ${reason}`
    );

    for (const action of actions) {
      if (
        Object.prototype.hasOwnProperty.call(
          state,
          action.actuator
        )
      ) {
        state[action.actuator] = action.state;

        console.log(
          `[ACTUATOR] ${action.actuator} -> ${action.state}`
        );
      }
    }

    const acknowledgement = {
      ackId: crypto.randomUUID(),
      farmId,
      shedId,
      reason,
      actuatorState: { ...state },
      commandCreatedAt: createdAt,
      acknowledgedAt: new Date().toISOString()
    };

    const ackTopic =
      `poultryguard/${farmId}/${shedId}/actuators/status`;

    client.publish(
      ackTopic,
      JSON.stringify(acknowledgement),
      { qos: 1 },
      (err) => {
        if (err) {
          console.error(
            "[ACK ERROR]",
            err.message
          );
          return;
        }

        console.log(
          `[ACK] Published ${ackTopic}`
        );

        console.log(
          JSON.stringify(
            acknowledgement,
            null,
            2
          )
        );
      }
    );
  } catch (err) {
    console.error(
      "[ACTUATOR ERROR]",
      err.message
    );
  }
});

client.on("error", (err) => {
  console.error(
    "[MQTT ERROR]",
    err.message
  );
});
