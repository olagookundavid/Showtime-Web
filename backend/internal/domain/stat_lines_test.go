package domain

import "testing"

func TestLiveStatLines(t *testing.T) {
	receiver := map[string]string{
		"catches": "6", "rec_yards": "84", "rec_td": "2",
		"stat1_lbl": "Catches", "stat1_val": "6",
		"stat2_lbl": "Rec Yds", "stat2_val": "84",
		"stat3_lbl": "Rec TDs", "stat3_val": "2",
	}
	typed := [3]StatLine{{"Catches", "0"}, {"Rec Yds", "0"}, {"Rec TD", "0"}}

	tests := []struct {
		name  string
		lines [3]StatLine
		stats map[string]string
		want  [3]StatLine
	}{
		{
			name:  "no recorded stats keeps what was typed",
			lines: [3]StatLine{{"Catches", "3"}, {"Rec Yds", "40"}, {"Rec TD", "1"}},
			stats: map[string]string{},
			want:  [3]StatLine{{"Catches", "3"}, {"Rec Yds", "40"}, {"Rec TD", "1"}},
		},
		{
			name:  "matching labels take the recorded values",
			lines: typed,
			stats: receiver,
			want:  [3]StatLine{{"Catches", "6"}, {"Rec Yds", "84"}, {"Rec TD", "2"}},
		},
		{
			name:  "labels match regardless of case and spacing",
			lines: [3]StatLine{{" catches ", "0"}, {"REC YDS", "0"}, {"Rec Td", "0"}},
			stats: receiver,
			want:  [3]StatLine{{" catches ", "6"}, {"REC YDS", "84"}, {"Rec Td", "2"}},
		},
		{
			name:  "an unknown label keeps its typed value next to matched ones",
			lines: [3]StatLine{{"Catches", "0"}, {"Hustle", "9"}, {"Rec TD", "0"}},
			stats: receiver,
			want:  [3]StatLine{{"Catches", "6"}, {"Hustle", "9"}, {"Rec TD", "2"}},
		},
		{
			name:  "no matching labels uses the suggested lines",
			lines: [3]StatLine{{"Stat 1", "0"}, {"Stat 2", "0"}, {"Stat 3", "0"}},
			stats: receiver,
			want:  [3]StatLine{{"Catches", "6"}, {"Rec Yds", "84"}, {"Rec TDs", "2"}},
		},
		{
			name:  "empty labels use the suggested lines",
			lines: [3]StatLine{},
			stats: receiver,
			want:  [3]StatLine{{"Catches", "6"}, {"Rec Yds", "84"}, {"Rec TDs", "2"}},
		},
		{
			name:  "no match and no suggestion keeps the lines",
			lines: [3]StatLine{{"Hustle", "9"}, {}, {}},
			stats: map[string]string{"catches": "0"},
			want:  [3]StatLine{{"Hustle", "9"}, {}, {}},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := LiveStatLines(tt.lines, tt.stats); got != tt.want {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}
