# PoultryGuard

PoultryGuard is an IoT monitoring and scalability prototype developed for SIT314 – Software Architecture and Scalability for IoT at Deakin University.

The project simulates telemetry from poultry sheds, processes MQTT messages using Node-RED and Node.js components, and evaluates horizontal scaling using AWS EC2 Auto Scaling and MQTT shared subscriptions.

## System Architecture

The implemented system includes:

- Poultry shed telemetry simulator
- Mosquitto MQTT broker
- Node-RED validation and routing
- Stateless Node.js telemetry workers
- MQTT shared subscriptions for distributing messages between workers
- AWS EC2 Auto Scaling Group
- Load generator for scalability and breaking-point testing

The original proposal considered an AWS IoT Core, SQS and ECS architecture. During implementation, the design evolved to an EC2 and Mosquitto architecture because it could be deployed, inspected and experimentally evaluated within the AWS Academy environment.

## Repository Structure

- `simulator/` – telemetry and actuator simulators
- `config/` – farm configuration
- `node-red/` – exported Node-RED flow
- `aws/broker/` – load generator and Mosquitto configuration
- `aws/worker/` – deployed telemetry worker and systemd service

## Local Prototype

The simulator generates poultry shed telemetry and supports repeatable fault conditions including abnormal temperature, feed conditions and offline behaviour.

Node-RED performs validation, routing, alert logic and actuator-related processing.

## AWS Scalability Implementation

The Mosquitto broker and stress-test load generator were hosted on an EC2 instance.

Telemetry processing was moved to stateless Node.js workers managed through an EC2 Auto Scaling Group. Workers use an MQTT shared subscription so matching messages are distributed across available workers.

The worker process automatically starts through systemd.

## Scalability Evaluation

The system was tested with progressively increasing MQTT publication rates.

Testing showed that the worker processing tier could distribute telemetry across multiple workers. However, once worker processing was horizontally scaled, the broker/load-generator EC2 host became the next bottleneck.

A target of 50,000 messages per second completed during testing. At 55,000 messages per second the load-generator process was terminated because of memory exhaustion. Higher stress testing, including 80,000 messages per second, also produced out-of-memory evidence.

This demonstrates that scaling one component does not automatically make the complete architecture scalable. Removing the worker bottleneck exposed the shared broker/load-generator host as the next limiting component.

## Technologies

- Node.js
- MQTT
- Mosquitto
- Node-RED
- AWS EC2
- EC2 Auto Scaling
- systemd

## Academic Context

This repository contains the implementation used for the PoultryGuard Distinction and High Distinction project in SIT314.

Generative AI tools were used as an assistance tool during development and documentation. The implementation was deployed, tested and evaluated in the project environment, and results were verified through practical execution and collected evidence.
