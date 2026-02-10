{
  "name": "ServiceRequest",
  "type": "object",
  "properties": {
    "request_number": {
      "type": "string",
      "description": "Auto-generated request ID"
    },
    "client_id": {
      "type": "string",
      "description": "Reference to Client"
    },
    "client_name": {
      "type": "string"
    },
    "farm_name": {
      "type": "string"
    },
    "contact_phone": {
      "type": "string"
    },
    "location": {
      "type": "object",
      "properties": {
        "lat": {
          "type": "number"
        },
        "lng": {
          "type": "number"
        },
        "address": {
          "type": "string"
        }
      }
    },
    "irrigation_type": {
      "type": "string",
      "enum": [
        "drip",
        "sprinkler",
        "center_pivot",
        "flood",
        "micro_sprinkler",
        "subsurface"
      ],
      "description": "Type of irrigation system"
    },
    "issue_category": {
      "type": "string",
      "enum": [
        "leak_repair",
        "system_installation",
        "maintenance",
        "pump_issue",
        "valve_replacement",
        "filter_cleaning",
        "pipe_repair",
        "controller_issue",
        "water_pressure",
        "other"
      ]
    },
    "priority": {
      "type": "string",
      "enum": [
        "low",
        "medium",
        "high",
        "urgent"
      ],
      "default": "medium"
    },
    "description": {
      "type": "string",
      "description": "Detailed issue description"
    },
    "photos": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Issue photos URLs"
    },
    "status": {
      "type": "string",
      "enum": [
        "new",
        "scheduled",
        "assigned",
        "in_progress",
        "completed",
        "approved",
        "closed",
        "rework"
      ],
      "default": "new"
    },
    "assigned_technician_id": {
      "type": "string"
    },
    "assigned_technician_name": {
      "type": "string"
    },
    "scheduled_date": {
      "type": "string",
      "format": "date"
    },
    "scheduled_time_slot": {
      "type": "string"
    },
    "estimated_duration": {
      "type": "number",
      "description": "Estimated hours"
    },
    "actual_start_time": {
      "type": "string",
      "format": "date-time"
    },
    "actual_end_time": {
      "type": "string",
      "format": "date-time"
    },
    "sla_deadline": {
      "type": "string",
      "format": "date-time"
    },
    "is_sla_breached": {
      "type": "boolean",
      "default": false
    },
    "acreage_affected": {
      "type": "number"
    },
    "notes": {
      "type": "string"
    }
  },
  "required": [
    "client_name",
    "irrigation_type",
    "issue_category",
    "description"
  ]
}