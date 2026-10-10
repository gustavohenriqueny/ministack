package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/ministack/backend/internal/ecs"
)

func TestECSAPI(t *testing.T) {
	ecsStore := ecs.NewStore()
	h := NewHandler(&mockClient{}, nil, ecsStore)
	r := NewRouter(h, nil)

	server := httptest.NewServer(r)
	defer server.Close()

	// 1. Create Cluster
	clusterReq := ecs.CreateClusterRequest{Name: "prod"}
	body, _ := json.Marshal(clusterReq)
	resp, err := http.Post(server.URL+"/api/v1/ecs/clusters", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Errorf("expected 201 Created; got %v", resp.Status)
	}

	// 2. List Clusters
	resp, err = http.Get(server.URL + "/api/v1/ecs/clusters")
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK; got %v", resp.Status)
	}
	var clusters []ecs.ECSCluster
	json.NewDecoder(resp.Body).Decode(&clusters)
	if len(clusters) != 1 || clusters[0].ClusterName != "prod" {
		t.Errorf("unexpected clusters list: %v", clusters)
	}

	// 3. Register Task Definition
	tdReq := ecs.RegisterTaskDefinitionRequest{
		Family:      "web",
		CPU:         "256",
		Memory:      "512",
		NetworkMode: "awsvpc",
		Container: ecs.ContainerDefinition{
			Name:  "web",
			Image: "nginx:alpine",
			PortMappings: []ecs.PortMapping{
				{ContainerPort: 80, Protocol: "tcp"},
			},
			Environment: []ecs.EnvironmentVariable{
				{Name: "PORT", Value: "80"},
			},
		},
	}
	body, _ = json.Marshal(tdReq)
	resp, err = http.Post(server.URL+"/api/v1/ecs/task-definitions", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Errorf("expected 201 Created; got %v", resp.Status)
	}

	// 4. Create Service
	svcReq := ecs.CreateServiceRequest{
		Name:           "nginx-service",
		TaskDefinition: "web:1",
		DesiredCount:   2,
	}
	body, _ = json.Marshal(svcReq)
	resp, err = http.Post(server.URL+"/api/v1/ecs/clusters/prod/services", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Errorf("expected 201 Created; got %v", resp.Status)
	}

	// 5. List Services
	resp, err = http.Get(server.URL + "/api/v1/ecs/clusters/prod/services")
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK; got %v", resp.Status)
	}
	var services []ecs.ECSService
	json.NewDecoder(resp.Body).Decode(&services)
	if len(services) != 1 || services[0].ServiceName != "nginx-service" {
		t.Errorf("unexpected services list: %v", services)
	}

	// 6. List Tasks
	resp, err = http.Get(server.URL + "/api/v1/ecs/clusters/prod/tasks")
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK; got %v", resp.Status)
	}
	var tasks []ecs.ECSTask
	json.NewDecoder(resp.Body).Decode(&tasks)
	if len(tasks) != 2 {
		t.Errorf("expected 2 tasks; got %v", len(tasks))
	}

	firstTask := tasks[0]
	if firstTask.TaskArn == "" {
		t.Errorf("expected non-empty TaskArn")
	}

	// 7. Test RunTask endpoint
	runTaskReq := ecs.RunTaskRequest{
		TaskDefinition: "web:1",
		Count:          1,
		Overrides: &ecs.TaskOverrides{
			ContainerOverrides: []ecs.ContainerOverride{
				{
					Name: "web",
					Environment: []ecs.EnvironmentVariable{
						{Name: "CUSTOM_FLAG", Value: "123"},
					},
				},
			},
		},
	}
	body, _ = json.Marshal(runTaskReq)
	resp, err = http.Post(server.URL+"/api/v1/ecs/clusters/prod/tasks/run", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Errorf("expected 201 Created for RunTask; got %v", resp.Status)
	}
	var launched []ecs.ECSTask
	json.NewDecoder(resp.Body).Decode(&launched)
	if len(launched) != 1 {
		t.Fatalf("expected 1 launched task; got %d", len(launched))
	}
	standaloneTask := launched[0]

	// 8. Test GetTaskLogs endpoint
	escapedArn := url.PathEscape(standaloneTask.TaskArn)
	resp, err = http.Get(server.URL + "/api/v1/ecs/tasks/" + escapedArn + "/logs?tail=50")
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK for GetTaskLogs; got %v", resp.Status)
	}
	var logsResp ecs.TaskLogsResponse
	json.NewDecoder(resp.Body).Decode(&logsResp)
	if logsResp.TaskArn != standaloneTask.TaskArn {
		t.Errorf("expected TaskArn %s; got %s", standaloneTask.TaskArn, logsResp.TaskArn)
	}
	if logsResp.Logs == "" {
		t.Errorf("expected non-empty logs")
	}

	// 9. Test InspectTask endpoint
	resp, err = http.Get(server.URL + "/api/v1/ecs/tasks/" + escapedArn + "/inspect")
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK for InspectTask; got %v", resp.Status)
	}
	var inspectResp ecs.TaskInspectResponse
	json.NewDecoder(resp.Body).Decode(&inspectResp)
	if inspectResp.Task == nil || inspectResp.Task.TaskArn != standaloneTask.TaskArn {
		t.Errorf("expected inspected task arn %s; got %v", standaloneTask.TaskArn, inspectResp.Task)
	}

	// 10. Test StopTask
	resp, err = http.Post(server.URL+"/api/v1/ecs/tasks/"+escapedArn+"/stop", "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK for StopTask; got %v", resp.Status)
	}
}
