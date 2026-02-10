{
  "name": "Notification",
  "type": "object",
  "properties": {
    "user_id": {
      "type": "string",
      "description": "User who will receive the notification"
    },
    "title": {
      "type": "string",
      "description": "Notification title"
    },
    "message": {
      "type": "string",
      "description": "Notification message"
    },
    "type": {
      "type": "string",
      "enum": [
        "job_assigned",
        "job_updated",
        "report_approved",
        "report_rejected",
        "system",
        "info"
      ],
      "default": "info",
      "description": "Type of notification"
    },
    "link": {
      "type": "string",
      "description": "URL or page to navigate to"
    },
    "related_id": {
      "type": "string",
      "description": "Related entity ID (job, report, etc)"
    },
    "is_read": {
      "type": "boolean",
      "default": false,
      "description": "Whether notification has been read"
    }
  },
  "required": [
    "user_id",
    "title",
    "message"
  ]
}