{
  "name": "TechnicianGoal",
  "type": "object",
  "properties": {
    "technician_id": {
      "type": "string",
      "description": "Reference to Technician"
    },
    "goal_type": {
      "type": "string",
      "enum": [
        "jobs_completed",
        "customer_rating",
        "response_time",
        "completion_rate",
        "custom"
      ],
      "description": "Type of goal"
    },
    "title": {
      "type": "string",
      "description": "Goal title"
    },
    "target_value": {
      "type": "number",
      "description": "Target value to achieve"
    },
    "current_value": {
      "type": "number",
      "default": 0,
      "description": "Current progress"
    },
    "period": {
      "type": "string",
      "enum": [
        "daily",
        "weekly",
        "monthly",
        "quarterly",
        "yearly"
      ],
      "default": "monthly",
      "description": "Goal period"
    },
    "status": {
      "type": "string",
      "enum": [
        "active",
        "completed",
        "failed",
        "archived"
      ],
      "default": "active"
    }
  },
  "required": [
    "technician_id",
    "goal_type",
    "title",
    "target_value"
  ]
}