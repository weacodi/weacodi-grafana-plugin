package plugin

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

const weacodiAPIHost = "http://weacodi-api:8080"

// handlePing is an example HTTP GET resource that returns a {"message": "ok"} JSON response.
func (a *App) handlePing(w http.ResponseWriter, req *http.Request) {
	w.Header().Add("Content-Type", "application/json")
	if _, err := w.Write([]byte(`{"message": "ok"}`)); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// handleEcho is an example HTTP POST resource that accepts a JSON with a "message" key and
// returns to the client whatever it is sent.
func (a *App) handleEcho(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Add("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(body); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func buildUpstreamURL(req *http.Request, baseURL string) (string, error) {
	if baseURL == "" {
		baseURL = weacodiAPIHost
	}

	parsedBase, err := url.Parse(baseURL)
	if err != nil {
		return "", err
	}

	path := strings.TrimPrefix(req.URL.Path, "/weacodi-api")
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	relPath, err := url.Parse(path)
	if err != nil {
		return "", err
	}

	resolved := parsedBase.ResolveReference(relPath)
	resolved.RawQuery = req.URL.RawQuery
	return resolved.String(), nil
}

func (a *App) handleWeaCoDiProxy(w http.ResponseWriter, req *http.Request) {
	var bodyReader io.Reader

	if req.Body != nil && req.Body != http.NoBody {
		bodyBytes, err := io.ReadAll(req.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		bodyReader = bytes.NewReader(bodyBytes)
		defer req.Body.Close()
	}

	apiBaseURL := req.Header.Get("X-WeaCoDi-Api-Url")
	apiKey := req.Header.Get("X-WeaCoDi-Api-Key")

	upstreamURL, err := buildUpstreamURL(req, apiBaseURL)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	upstreamReq, err := http.NewRequestWithContext(req.Context(), req.Method, upstreamURL, bodyReader)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	upstreamReq.Header = req.Header.Clone()
	upstreamReq.Header.Del("X-WeaCoDi-Api-Url")
	upstreamReq.Header.Del("X-WeaCoDi-Api-Key")

	if apiKey != "" {
		upstreamReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))
	}

	resp, err := http.DefaultClient.Do(upstreamReq)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	w.WriteHeader(resp.StatusCode)
	if _, err := io.Copy(w, resp.Body); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

// registerRoutes takes a *http.ServeMux and registers some HTTP handlers.
func (a *App) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/ping", a.handlePing)
	mux.HandleFunc("/echo", a.handleEcho)
	mux.HandleFunc("/weacodi-api", a.handleWeaCoDiProxy)
	mux.HandleFunc("/weacodi-api/", a.handleWeaCoDiProxy)
}
