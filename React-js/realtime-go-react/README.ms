# Real-Time Deadline-Aware Event Monitor

This project is a **real-time web application** that demonstrates how deadline-aware systems behave under load. It simulates a stream of events generated at a fixed rate, processes them with strict time constraints, and visualizes the results live in the browser.

The goal of this project is to show that **real-time systems are not just about speed, but about predictability and deadlines**.

---

## 🚀 What This App Does

* Generates events every **50 milliseconds** on the backend
* Assigns each event a **deadline**
* Processes events with simulated work
* Classifies events as:

  * ✅ **On-time** (processed before the deadline)
  * ❌ **Late** (processed after the deadline)
  * ⚠️ **Dropped** (discarded due to system overload)
* Streams results to the frontend in **real time using WebSockets**
* Displays live metrics and a continuously updating table

---

## 🧠 Why This Matters

Instead of buffering endlessly, the system:

* Uses **bounded queues** to apply backpressure
* **Drops work intentionally** when overloaded
* Makes system behavior visible rather than hiding failures

This mirrors how real-world systems like trading platforms, IoT pipelines, and real-time monitoring tools are designed.

---

## 🛠 Tech Stack

### Backend

* Go
* Gorilla WebSocket
* Context-based deadlines
* Concurrent event processing

### Frontend

* React + TypeScript
* WebSocket client
* Render-optimized state updates
* Live latency calculations

---

## 📊 Features

* Real-time event table
* Color-coded status indicators:

  * Green = On-time
  * Red = Late
  * Gray = Dropped
* Live latency (ms) per event
* Event statistics dashboard
* Pause / resume event generation (optional)

---

## 🧪 What This Demonstrates

* Real-time system fundamentals
* Deadline-aware processing
* Backpressure and overload handling
* Safe concurrent programming
* Efficient real-time UI rendering

---

## 🌐 Live Demo

* Frontend: GitHub Pages
* Backend: Deployed on a cloud platform with WebSocket support

(See repository settings or deployment section for URLs.)

---

## 📌 Future Improvements

* Charts for latency trends
* Multiple client support
* Authentication
* Configurable load levels
* Dockerized deployment

---

## 🧑‍💻 Author

Built as a learning project to explore **real-time systems for web developers**, combining backend concurrency with frontend performance-aware rendering.
