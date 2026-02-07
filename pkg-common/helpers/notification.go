package helpers

type NotificationTitle string
type NotificationType string
type NotificationAudeince string
type NotificationMethod string
type NotificationStatus string

const (
	NewStoreNotificationType      NotificationType = "new_store_notification"
	SupportTicketNotificationType NotificationType = "support_notification"
	PayoutNotificationType        NotificationType = "payout_notification"
	SubscriptionNotificationType  NotificationType = "subscription_notification"
	SuspiciousNotificationType    NotificationType = "suspicious_notification"
	SystemAlertNotificationType   NotificationType = "system_alert_notification"
)

const (
	NewStoreNotificationTitle      NotificationTitle = "Store Creation"
	SupportTicketNotificationTitle NotificationTitle = "Support Ticket"
	PayoutTicketNotificationTitle  NotificationTitle = "Payout Ticket"
	SubscriptionNotificationTitle  NotificationTitle = "Subscription"
	SuspiciousNotificationTitle    NotificationTitle = "Suspicious Activity"
	SystemAlertNotificationTitle   NotificationTitle = "System Alert"
)

const (
	AllUsersNotificationAudience NotificationAudeince = "All Users"
	MerchantNotificationAudience NotificationAudeince = "Merchants"
	CustomerNotificationAudience NotificationAudeince = "Customers"
)

const (
	SentNotificationStatus      NotificationStatus = "Sent"
	ScheduledNotificationStatus NotificationStatus = "Scheduled"
	FailedNotificationStatus    NotificationStatus = "Failed"
)
