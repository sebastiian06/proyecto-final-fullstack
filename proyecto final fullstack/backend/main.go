package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
)

type Proyecto struct {
	ID            int       `json:"id"`
	Nombre        string    `json:"nombre"`
	Descripcion   string    `json:"descripcion"`
	FechaCreacion time.Time `json:"fecha_creacion"`
}

type Tarea struct {
	ID               int       `json:"id"`
	DescripcionTarea string    `json:"descripcion_tarea"`
	Estado           string    `json:"estado"`
	FechaLimite      time.Time `json:"fecha_limite"`
	ProyectoID       int       `json:"proyecto_id"`
}

func main() {
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Crear tablas si no existen
	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS proyectos (
            id SERIAL PRIMARY KEY,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            fecha_creacion TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS tareas (
            id SERIAL PRIMARY KEY,
            descripcion_tarea TEXT NOT NULL,
            estado TEXT CHECK (estado IN ('Pendiente', 'En Progreso', 'Completada')) DEFAULT 'Pendiente',
            fecha_limite DATE,
            proyecto_id INT REFERENCES proyectos(id) ON DELETE CASCADE
        );
    `)
	if err != nil {
		log.Fatal(err)
	}

	router := mux.NewRouter()

	// Rutas de proyectos
	router.HandleFunc("/api/go/proyectos", getProyectos(db)).Methods("GET")
	router.HandleFunc("/api/go/proyectos", createProyecto(db)).Methods("POST")
	router.HandleFunc("/api/go/proyectos/{id}", getProyecto(db)).Methods("GET")
	router.HandleFunc("/api/go/proyectos/{id}", updateProyecto(db)).Methods("PUT")
	router.HandleFunc("/api/go/proyectos/{id}", deleteProyecto(db)).Methods("DELETE")

	// Rutas de tareas
	router.HandleFunc("/api/go/tareas", getTareas(db)).Methods("GET")
	router.HandleFunc("/api/go/tareas", createTarea(db)).Methods("POST")
	router.HandleFunc("/api/go/tareas/{id}", getTarea(db)).Methods("GET")
	router.HandleFunc("/api/go/tareas/{id}", updateTarea(db)).Methods("PUT")
	router.HandleFunc("/api/go/tareas/{id}", deleteTarea(db)).Methods("DELETE")

	enhancedRouter := enableCORS(jsonContentTypeMiddleware(router))
	log.Println("Servidor corriendo en puerto 8000")
	log.Fatal(http.ListenAndServe(":8000", enhancedRouter))
}

// ---------- Middlewares ----------
func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func jsonContentTypeMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		next.ServeHTTP(w, r)
	})
}

// ---------- CRUD Proyectos ----------
func getProyectos(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query("SELECT id, nombre, descripcion, fecha_creacion FROM proyectos ORDER BY id DESC")
		if err != nil {
			log.Fatal(err)
		}
		defer rows.Close()

		var proyectos []Proyecto
		for rows.Next() {
			var p Proyecto
			rows.Scan(&p.ID, &p.Nombre, &p.Descripcion, &p.FechaCreacion)
			proyectos = append(proyectos, p)
		}
		json.NewEncoder(w).Encode(proyectos)
	}
}

func createProyecto(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var p Proyecto
		json.NewDecoder(r.Body).Decode(&p)
		err := db.QueryRow("INSERT INTO proyectos (nombre, descripcion) VALUES ($1, $2) RETURNING id, fecha_creacion",
			p.Nombre, p.Descripcion).Scan(&p.ID, &p.FechaCreacion)
		if err != nil {
			log.Fatal(err)
		}
		json.NewEncoder(w).Encode(p)
	}
}

func getProyecto(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]
		var p Proyecto
		err := db.QueryRow("SELECT id, nombre, descripcion, fecha_creacion FROM proyectos WHERE id=$1", id).
			Scan(&p.ID, &p.Nombre, &p.Descripcion, &p.FechaCreacion)
		if err != nil {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(p)
	}
}

func updateProyecto(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]
		var p Proyecto
		json.NewDecoder(r.Body).Decode(&p)
		_, err := db.Exec("UPDATE proyectos SET nombre=$1, descripcion=$2 WHERE id=$3", p.Nombre, p.Descripcion, id)
		if err != nil {
			log.Fatal(err)
		}
		getProyecto(db)(w, r)
	}
}

func deleteProyecto(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]
		_, err := db.Exec("DELETE FROM proyectos WHERE id=$1", id)
		if err != nil {
			log.Fatal(err)
		}
		json.NewEncoder(w).Encode(map[string]string{"mensaje": "Proyecto eliminado"})
	}
}

// ---------- CRUD Tareas ----------
func getTareas(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query("SELECT id, descripcion_tarea, estado, fecha_limite, proyecto_id FROM tareas ORDER BY id DESC")
		if err != nil {
			log.Fatal(err)
		}
		defer rows.Close()

		var tareas []Tarea
		for rows.Next() {
			var t Tarea
			rows.Scan(&t.ID, &t.DescripcionTarea, &t.Estado, &t.FechaLimite, &t.ProyectoID)
			tareas = append(tareas, t)
		}
		json.NewEncoder(w).Encode(tareas)
	}
}

func createTarea(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var t Tarea
		json.NewDecoder(r.Body).Decode(&t)
		err := db.QueryRow("INSERT INTO tareas (descripcion_tarea, estado, fecha_limite, proyecto_id) VALUES ($1, $2, $3, $4) RETURNING id",
			t.DescripcionTarea, t.Estado, t.FechaLimite, t.ProyectoID).Scan(&t.ID)
		if err != nil {
			log.Fatal(err)
		}
		json.NewEncoder(w).Encode(t)
	}
}

func getTarea(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]
		var t Tarea
		err := db.QueryRow("SELECT id, descripcion_tarea, estado, fecha_limite, proyecto_id FROM tareas WHERE id=$1", id).
			Scan(&t.ID, &t.DescripcionTarea, &t.Estado, &t.FechaLimite, &t.ProyectoID)
		if err != nil {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(t)
	}
}

func updateTarea(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]
		var t Tarea
		json.NewDecoder(r.Body).Decode(&t)
		_, err := db.Exec("UPDATE tareas SET descripcion_tarea=$1, estado=$2, fecha_limite=$3, proyecto_id=$4 WHERE id=$5",
			t.DescripcionTarea, t.Estado, t.FechaLimite, t.ProyectoID, id)
		if err != nil {
			log.Fatal(err)
		}
		getTarea(db)(w, r)
	}
}

func deleteTarea(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]
		_, err := db.Exec("DELETE FROM tareas WHERE id=$1", id)
		if err != nil {
			log.Fatal(err)
		}
		json.NewEncoder(w).Encode(map[string]string{"mensaje": "Tarea eliminada"})
	}
}
