package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
)

type PaystackClient struct {
	secretKey string
	baseURL   string
	client    *http.Client
}

type PaystackInitRequest struct {
	Email       string `json:"email"`
	Amount      int    `json:"amount"` // in kobo (Naira * 100)
	Reference   string `json:"reference,omitempty"`
	CallbackURL string `json:"callback_url,omitempty"`
}

type PaystackInitResponse struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    struct {
		AuthorizationURL string `json:"authorization_url"`
		AccessCode       string `json:"access_code"`
		Reference        string `json:"reference"`
	} `json:"data"`
}

type PaystackVerifyResponse struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    struct {
		Status    string `json:"status"`
		Reference string `json:"reference"`
		Amount    int    `json:"amount"`
		Channel   string `json:"channel"`
		PaidAt    string `json:"paid_at"`
	} `json:"data"`
}

func NewPaystackClient() *PaystackClient {
	key := os.Getenv("PAYSTACK_SECRET_KEY")
	if key == "" {
		log.Fatal("Couldn't load paystack secret key")
	}
	return &PaystackClient{
		secretKey: key,
		baseURL:   "https://api.paystack.co",
		client:    &http.Client{},
	}
}

func (p *PaystackClient) InitializeTransaction(req PaystackInitRequest) (*PaystackInitResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		println(err.Error())
		return nil, err
	}

	httpReq, err := http.NewRequest("POST", p.baseURL+"/transaction/initialize", bytes.NewBuffer(body))
	if err != nil {
		println(err.Error())
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+p.secretKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(httpReq)
	if err != nil {
		println(err.Error())
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		println(err.Error())
		return nil, err
	}

	var result PaystackInitResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		println(err.Error())
		return nil, err
	}

	if !result.Status {
		println(result.Message)
		return nil, fmt.Errorf("paystack error: %s", result.Message)
	}

	return &result, nil
}

func (p *PaystackClient) VerifyTransaction(reference string) (*PaystackVerifyResponse, error) {
	httpReq, err := http.NewRequest("GET", p.baseURL+"/transaction/verify/"+reference, nil)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+p.secretKey)

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result PaystackVerifyResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

func (p *PaystackClient) GetSecretKey() string {
	return p.secretKey
}
