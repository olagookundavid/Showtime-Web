package services

import "testing"

func TestSplitFullName(t *testing.T) {
	tests := []struct {
		in, first, last string
	}{
		{"Ada Obi", "Ada", "Obi"},
		{"  Ada   Obi  ", "Ada", "Obi"},
		{"Ada", "Ada", ""},
		{"Mary Jane Watson", "Mary", "Jane Watson"},
		{"", "", ""},
		{"   ", "", ""},
	}
	for _, tt := range tests {
		first, last := splitFullName(tt.in)
		if first != tt.first || last != tt.last {
			t.Errorf("splitFullName(%q) = (%q, %q), want (%q, %q)", tt.in, first, last, tt.first, tt.last)
		}
	}
}

type fakeSyncer struct{ got []string }

func (f *fakeSyncer) AddContact(email, first, last string) error {
	f.got = append(f.got, email+"|"+first+"|"+last)
	return nil
}

// A missing syncer or address must be a quiet no-op, since the call sits on the
// signup and payment paths.
func TestAddMarketingContactIgnoresNothingToAdd(t *testing.T) {
	addMarketingContact(nil, "a@b.com", "A", "B")
	f := &fakeSyncer{}
	addMarketingContact(f, "   ", "A", "B")
	if len(f.got) != 0 {
		t.Errorf("expected nothing queued, got %v", f.got)
	}
}
