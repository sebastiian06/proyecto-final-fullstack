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

// Estructuras para Proyectos y Tareas
type Proyecto struct {
	ID            int       `json:"id"`
	Nombre        string    `json:"nombre"`
	Descripcion   string    `json:"descripcion"`
	FechaCreacion time.Time `json:"fecha_creacion"`
}

type Tarea struct {
	ID               int    `json:"id"`
	DescripcionTarea string `json:"descripcion_tarea"`
	Estado           string `json:"estado"`
	FechaLimite      string `json:"fecha_limite"` // Mantener como string
	ProyectoID       int    `json:"proyecto_id"`
}

// Función Principal
func main() {
	// Conectar a la base de datos
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Esperar a que la base de datos esté lista
	for i := 0; i < 10; i++ {
		err = db.Ping()
		if err == nil {
			break
		}
		log.Printf("Esperando a la base de datos... (intento %d/10)", i+1)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		log.Fatal("No se pudo conectar a la base de datos después de 10 intentos:", err)
	}

	// Crear tablas si no existen
	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS proyectos (
            id SERIAL PRIMARY KEY,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `)
	if err != nil {
		log.Fatal(err)
	}

	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS tareas (
            id SERIAL PRIMARY KEY,
            descripcion_tarea TEXT NOT NULL,
            estado TEXT DEFAULT 'Pendiente',
            fecha_limite DATE,
            proyecto_id INTEGER REFERENCES proyectos(id) ON DELETE CASCADE
        )
    `)
	if err != nil {
		log.Fatal(err)
	}

	log.Println("Tablas creadas/verificadas correctamente")

	// Crear router para endpoints
	router := mux.NewRouter()

	// Endpoints para Proyectos
	router.HandleFunc("/api/go/proyectos", getProyectos(db)).Methods("GET")
	router.HandleFunc("/api/go/proyectos", createProyecto(db)).Methods("POST")
	router.HandleFunc("/api/go/proyectos/{id}", getProyecto(db)).Methods("GET")
	router.HandleFunc("/api/go/proyectos/{id}", updateProyecto(db)).Methods("PUT")
	router.HandleFunc("/api/go/proyectos/{id}", deleteProyecto(db)).Methods("DELETE")

	// Endpoints para Tareas
	router.HandleFunc("/api/go/tareas", getTareas(db)).Methods("GET")
	router.HandleFunc("/api/go/tareas", createTarea(db)).Methods("POST")
	router.HandleFunc("/api/go/tareas/{id}", getTarea(db)).Methods("GET")
	router.HandleFunc("/api/go/tareas/{id}", updateTarea(db)).Methods("PUT")
	router.HandleFunc("/api/go/tareas/{id}", deleteTarea(db)).Methods("DELETE")
	router.HandleFunc("/api/go/proyectos/{id}/tareas", getTareasByProyecto(db)).Methods("GET")

	// Ajustar Problema del CORS y el contenido JSON middlewares
	enhancedRouter := enableCORS(jsonContentTypeMiddleware(router))

	log.Println("Servidor iniciado en el puerto :8000")
	// Arrancar el servidor
	log.Fatal(http.ListenAndServe(":8000", enhancedRouter))
}

// Funciones para EnableCORS y jsonContentTypeMiddleware
func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

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

// --- FUNCIONES PARA PROYECTOS ---

// Obtener todos los proyectos
func getProyectos(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query("SELECT id, nombre, descripcion, fecha_creacion FROM proyectos ORDER BY fecha_creacion DESC")
		if err != nil {
			log.Printf("Error obteniendo proyectos: %v", err)
			http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		proyectos := []Proyecto{}
		for rows.Next() {
			var p Proyecto
			if err := rows.Scan(&p.ID, &p.Nombre, &p.Descripcion, &p.FechaCreacion); err != nil {
				log.Printf("Error escaneando proyecto: %v", err)
				continue
			}
			proyectos = append(proyectos, p)
		}
		if err := rows.Err(); err != nil {
			log.Printf("Error en rows: %v", err)
			http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(proyectos)
	}
}

// Obtener proyecto por ID
func getProyecto(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]

		var p Proyecto
		err := db.QueryRow("SELECT id, nombre, descripcion, fecha_creacion FROM proyectos WHERE id = $1", id).Scan(&p.ID, &p.Nombre, &p.Descripcion, &p.FechaCreacion)
		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Proyecto no encontrado", http.StatusNotFound)
			} else {
				log.Printf("Error obteniendo proyecto: %v", err)
				http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
			}
			return
		}

		json.NewEncoder(w).Encode(p)
	}
}

// Crear proyecto
func createProyecto(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var p Proyecto
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			log.Printf("Error decodificando JSON: %v", err)
			http.Error(w, "Error en el formato de los datos", http.StatusBadRequest)
			return
		}

		if p.Nombre == "" {
			http.Error(w, "El nombre del proyecto es obligatorio", http.StatusBadRequest)
			return
		}

		err := db.QueryRow(
			"INSERT INTO proyectos (nombre, descripcion) VALUES ($1, $2) RETURNING id, fecha_creacion",
			p.Nombre, p.Descripcion,
		).Scan(&p.ID, &p.FechaCreacion)

		if err != nil {
			log.Printf("Error creando proyecto: %v", err)
			http.Error(w, "Error al crear el proyecto", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(p)
	}
}

// Actualizar proyecto
func updateProyecto(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]

		var p Proyecto
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			log.Printf("Error decodificando JSON: %v", err)
			http.Error(w, "Error en el formato de los datos", http.StatusBadRequest)
			return
		}

		if p.Nombre == "" {
			http.Error(w, "El nombre del proyecto es obligatorio", http.StatusBadRequest)
			return
		}

		result, err := db.Exec("UPDATE proyectos SET nombre = $1, descripcion = $2 WHERE id = $3", p.Nombre, p.Descripcion, id)
		if err != nil {
			log.Printf("Error actualizando proyecto: %v", err)
			http.Error(w, "Error al actualizar el proyecto", http.StatusInternalServerError)
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			http.Error(w, "Proyecto no encontrado", http.StatusNotFound)
			return
		}

		var updatedProyecto Proyecto
		err = db.QueryRow("SELECT id, nombre, descripcion, fecha_creacion FROM proyectos WHERE id = $1", id).Scan(
			&updatedProyecto.ID, &updatedProyecto.Nombre, &updatedProyecto.Descripcion, &updatedProyecto.FechaCreacion,
		)
		if err != nil {
			log.Printf("Error obteniendo proyecto actualizado: %v", err)
			http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(updatedProyecto)
	}
}

// Eliminar proyecto
func deleteProyecto(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]

		result, err := db.Exec("DELETE FROM proyectos WHERE id = $1", id)
		if err != nil {
			log.Printf("Error eliminando proyecto: %v", err)
			http.Error(w, "Error al eliminar el proyecto", http.StatusInternalServerError)
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			http.Error(w, "Proyecto no encontrado", http.StatusNotFound)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"message": "Proyecto eliminado correctamente"})
	}
}

// --- FUNCIONES PARA TAREAS ---

// Obtener todas las tareas
func getTareas(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query("SELECT id, descripcion_tarea, estado, fecha_limite, proyecto_id FROM tareas ORDER BY fecha_limite ASC")
		if err != nil {
			log.Printf("Error obteniendo tareas: %v", err)
			http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		tareas := []Tarea{}
		for rows.Next() {
			var t Tarea
			var fechaLimite sql.NullTime
			if err := rows.Scan(&t.ID, &t.DescripcionTarea, &t.Estado, &fechaLimite, &t.ProyectoID); err != nil {
				log.Printf("Error escaneando tarea: %v", err)
				continue
			}
			// Convertir time.Time a string para la respuesta JSON
			if fechaLimite.Valid {
				t.FechaLimite = fechaLimite.Time.Format("2006-01-02")
			}
			tareas = append(tareas, t)
		}
		if err := rows.Err(); err != nil {
			log.Printf("Error en rows: %v", err)
			http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(tareas)
	}
}

// Obtener tareas por proyecto
func getTareasByProyecto(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		proyectoID := vars["id"]

		rows, err := db.Query("SELECT id, descripcion_tarea, estado, fecha_limite, proyecto_id FROM tareas WHERE proyecto_id = $1 ORDER BY fecha_limite ASC", proyectoID)
		if err != nil {
			log.Printf("Error obteniendo tareas por proyecto: %v", err)
			http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		tareas := []Tarea{}
		for rows.Next() {
			var t Tarea
			var fechaLimite sql.NullTime
			if err := rows.Scan(&t.ID, &t.DescripcionTarea, &t.Estado, &fechaLimite, &t.ProyectoID); err != nil {
				log.Printf("Error escaneando tarea: %v", err)
				continue
			}
			// Convertir time.Time a string para la respuesta JSON
			if fechaLimite.Valid {
				t.FechaLimite = fechaLimite.Time.Format("2006-01-02")
			}
			tareas = append(tareas, t)
		}
		if err := rows.Err(); err != nil {
			log.Printf("Error en rows: %v", err)
			http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(tareas)
	}
}

// Obtener tarea por ID
func getTarea(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]

		var t Tarea
		var fechaLimite sql.NullTime
		err := db.QueryRow("SELECT id, descripcion_tarea, estado, fecha_limite, proyecto_id FROM tareas WHERE id = $1", id).Scan(
			&t.ID, &t.DescripcionTarea, &t.Estado, &fechaLimite, &t.ProyectoID,
		)
		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Tarea no encontrada", http.StatusNotFound)
			} else {
				log.Printf("Error obteniendo tarea: %v", err)
				http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
			}
			return
		}

		// Convertir time.Time a string para la respuesta JSON
		if fechaLimite.Valid {
			t.FechaLimite = fechaLimite.Time.Format("2006-01-02")
		}

		json.NewEncoder(w).Encode(t)
	}
}

// Crear tarea
func createTarea(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var t Tarea
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			log.Printf("Error decodificando JSON: %v", err)
			http.Error(w, "Error en el formato de los datos", http.StatusBadRequest)
			return
		}

		// Log para debugging
		log.Printf("Datos recibidos para crear tarea: %+v", t)

		// Validar campos requeridos
		if t.DescripcionTarea == "" {
			http.Error(w, "La descripción de la tarea es obligatoria", http.StatusBadRequest)
			return
		}
		if t.ProyectoID == 0 {
			http.Error(w, "El proyecto es obligatorio", http.StatusBadRequest)
			return
		}
		if t.FechaLimite == "" {
			http.Error(w, "La fecha límite es obligatoria", http.StatusBadRequest)
			return
		}

		// Validar que el proyecto existe
		var proyectoExists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM proyectos WHERE id = $1)", t.ProyectoID).Scan(&proyectoExists)
		if err != nil {
			log.Printf("Error verificando proyecto: %v", err)
			http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
			return
		}

		if !proyectoExists {
			log.Printf("Proyecto no encontrado: %d", t.ProyectoID)
			http.Error(w, "El proyecto especificado no existe", http.StatusBadRequest)
			return
		}

		// Si no se proporciona estado, usar "Pendiente" por defecto
		if t.Estado == "" {
			t.Estado = "Pendiente"
		}

		// Insertar la tarea
		err = db.QueryRow(
			"INSERT INTO tareas (descripcion_tarea, estado, fecha_limite, proyecto_id) VALUES ($1, $2, $3, $4) RETURNING id",
			t.DescripcionTarea, t.Estado, t.FechaLimite, t.ProyectoID,
		).Scan(&t.ID)

		if err != nil {
			log.Printf("Error creando tarea: %v", err)
			http.Error(w, "Error al crear la tarea: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(t)
	}
}

// Actualizar tarea
func updateTarea(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]

		var t Tarea
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			log.Printf("Error decodificando JSON: %v", err)
			http.Error(w, "Error en el formato de los datos", http.StatusBadRequest)
			return
		}

		// Validar campos requeridos
		if t.DescripcionTarea == "" {
			http.Error(w, "La descripción de la tarea es obligatoria", http.StatusBadRequest)
			return
		}
		if t.ProyectoID == 0 {
			http.Error(w, "El proyecto es obligatorio", http.StatusBadRequest)
			return
		}
		if t.FechaLimite == "" {
			http.Error(w, "La fecha límite es obligatoria", http.StatusBadRequest)
			return
		}

		// Validar que el proyecto existe
		var proyectoExists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM proyectos WHERE id = $1)", t.ProyectoID).Scan(&proyectoExists)
		if err != nil {
			log.Printf("Error verificando proyecto: %v", err)
			http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
			return
		}

		if !proyectoExists {
			http.Error(w, "El proyecto especificado no existe", http.StatusBadRequest)
			return
		}

		result, err := db.Exec(
			"UPDATE tareas SET descripcion_tarea = $1, estado = $2, fecha_limite = $3, proyecto_id = $4 WHERE id = $5",
			t.DescripcionTarea, t.Estado, t.FechaLimite, t.ProyectoID, id,
		)
		if err != nil {
			log.Printf("Error actualizando tarea: %v", err)
			http.Error(w, "Error al actualizar la tarea", http.StatusInternalServerError)
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			http.Error(w, "Tarea no encontrada", http.StatusNotFound)
			return
		}

		var updatedTarea Tarea
		var fechaLimite sql.NullTime
		err = db.QueryRow("SELECT id, descripcion_tarea, estado, fecha_limite, proyecto_id FROM tareas WHERE id = $1", id).Scan(
			&updatedTarea.ID, &updatedTarea.DescripcionTarea, &updatedTarea.Estado, &fechaLimite, &updatedTarea.ProyectoID,
		)
		if err != nil {
			log.Printf("Error obteniendo tarea actualizada: %v", err)
			http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
			return
		}

		// Convertir time.Time a string para la respuesta JSON
		if fechaLimite.Valid {
			updatedTarea.FechaLimite = fechaLimite.Time.Format("2006-01-02")
		}

		json.NewEncoder(w).Encode(updatedTarea)
	}
}

// Eliminar tarea
func deleteTarea(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]

		result, err := db.Exec("DELETE FROM tareas WHERE id = $1", id)
		if err != nil {
			log.Printf("Error eliminando tarea: %v", err)
			http.Error(w, "Error al eliminar la tarea", http.StatusInternalServerError)
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			http.Error(w, "Tarea no encontrada", http.StatusNotFound)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"message": "Tarea eliminada correctamente"})
	}
}
