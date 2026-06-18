package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Event struct {
	ID string `json:"id"`
	CreatedAt time.Time `json:"createdAt"`
	ProcessedAt time.Time `json:"processedAt"`
	DeadlineMs int64 `json:"deadlineMs"`
	Status string `json:"status" `
	// "on-tome" | "late" | "dropped"
}

// WebSocket upgrader (allows browser to connect)
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool{
		return true // dev only. Lock this down in production
	},
}

/*
	Step A: Generate events at fixed rate (50ms)
	This matches the article's idea:
	- ticker every 50ms
	- each event deadline = 100ms
	- non-blocking send; drop if overloaded
*/

func startGenerator(out chan<- Event){
	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		event := Event{
			ID: uuid.New().String(),
			CreatedAt: time.Now(),
			DeadlineMs: 100,
			Status: "dropped", // default if we cant enqueue it
		}

		// Non-blocking send: if channel is full, drop it
		select{
		case out <- event:
			event.Status = "on-time"
			// queued sucessfully
		default:
			event.Status = "dropped"
			out <- event
			// dropped due to overload (backpressure strategy)
		}
	}
}

/*
	Step B: Deadline-aware processing
	Uses context timeout tied to event deadline.
	If work finishes before deadline => on-time
	If not => late
*/

func processEvent(event Event) Event{
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(event.DeadlineMs)*time.Millisecond)
	defer cancel()

	workDone := make(chan struct{})

	// simulate doing work (50ms)
	go func() {
		time.Sleep(50 * time.Millisecond)
		close(workDone)
	}()

	select{
	case <-workDone:
		event.Status = "on-time"
		event.ProcessedAt = time.Now()
		return event

	case <-ctx.Done():
		event.Status = "late"
		event.ProcessedAt = time.Now()
		return event
	}
}

/*
	Step C: Processor worker
	Reads from generator channel, processes, then sends to broadcast channel.
*/

func startProcessor(in <-chan Event, out chan<- Event) {
	for e := range in{
		processed := processEvent(e)
		out <- processed
	}
}

/*
	Step D: Stream to browser via WebSocket
	Continuously reads from processed-event channel and writes JSON over WS.
*/
func wsHandler(out <-chan Event) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil{
			log.Println("WS upgrade error:", err)
			return
		}
		defer conn.Close()

		for event := range out{
			data, err := json.Marshal(event)
			if err != nil {
				continue
			}
			if err := conn.WriteMessage(websocket.TextMessage, data); err != nil{
			return
		}
	}
  }
}

func main(){
	// Bounded channels = controlled backpressure
	generated := make(chan Event, 10)
	processed := make(chan Event, 10)

	// start generator + processor
	go startGenerator(generated)
	go startProcessor(generated, processed)

	// Websocket endpoint
	http.HandleFunc("/ws", wsHandler(processed))

	log.Println("Go WebSocket server running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}