package email

import (
	"errors"
	"testing"
)

func TestAddContactIfNew(t *testing.T) {
	tests := []struct {
		name        string
		lookupErr   error
		createErr   error
		wantCreated bool
		wantErr     bool
	}{
		{name: "already on the list is left alone", lookupErr: nil, wantCreated: false},
		{name: "not found is created", lookupErr: errors.New("Contact not found"), wantCreated: true},
		{name: "other lookup failure creates nothing", lookupErr: errors.New("connection reset"), wantCreated: false, wantErr: true},
		{name: "create failure is reported", lookupErr: errors.New("404 not found"), createErr: errors.New("boom"), wantCreated: true, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			created := false
			err := addContactIfNew(
				func() error { return tt.lookupErr },
				func() error { created = true; return tt.createErr },
			)
			if created != tt.wantCreated {
				t.Errorf("created = %v, want %v", created, tt.wantCreated)
			}
			if (err != nil) != tt.wantErr {
				t.Errorf("err = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
