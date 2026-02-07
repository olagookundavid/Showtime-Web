package utils

type TaskLevel string

const (
	ResetPassword = "reset-password"
	Signup        = "signup"

	// task-level

	TaskCritical TaskLevel = "critical"
	TaskDefault  TaskLevel = "default"
	TaskLow      TaskLevel = "low"
)
