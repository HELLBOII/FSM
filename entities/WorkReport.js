{
  "name": "WorkReport",
  "type": "object",
  "properties": {
    "service_request_id": {
      "type": "string"
    },
    "request_number": {
      "type": "string"
    },
    "technician_id": {
      "type": "string"
    },
    "technician_name": {
      "type": "string"
    },
    "client_name": {
      "type": "string"
    },
    "farm_name": {
      "type": "string"
    },
    "check_in_time": {
      "type": "string",
      "format": "date-time"
    },
    "check_in_location": {
      "type": "object",
      "properties": {
        "lat": {
          "type": "number"
        },
        "lng": {
          "type": "number"
        }
      }
    },
    "check_out_time": {
      "type": "string",
      "format": "date-time"
    },
    "check_out_location": {
      "type": "object",
      "properties": {
        "lat": {
          "type": "number"
        },
        "lng": {
          "type": "number"
        }
      }
    },
    "before_photos": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "after_photos": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "tasks_completed": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "task": {
            "type": "string"
          },
          "completed": {
            "type": "boolean"
          },
          "notes": {
            "type": "string"
          }
        }
      }
    },
    "equipment_used": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "quantity": {
            "type": "number"
          },
          "unit": {
            "type": "string"
          }
        }
      }
    },
    "water_flow_reading": {
      "type": "number",
      "description": "GPM or LPM"
    },
    "pressure_reading": {
      "type": "number",
      "description": "PSI"
    },
    "work_notes": {
      "type": "string"
    },
    "voice_notes_url": {
      "type": "string"
    },
    "farmer_signature_url": {
      "type": "string"
    },
    "farmer_feedback": {
      "type": "string"
    },
    "farmer_rating": {
      "type": "number"
    },
    "status": {
      "type": "string",
      "enum": [
        "draft",
        "submitted",
        "approved",
        "rejected"
      ],
      "default": "draft"
    },
    "rejection_reason": {
      "type": "string"
    },
    "approved_by": {
      "type": "string"
    },
    "approved_at": {
      "type": "string",
      "format": "date-time"
    }
  },
  "required": [
    "service_request_id",
    "technician_id"
  ]
}