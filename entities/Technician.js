{
  "name": "Technician",
  "type": "object",
  "properties": {
    "user_id": {
      "type": "string",
      "description": "Reference to User entity"
    },
    "name": {
      "type": "string",
      "description": "Full name"
    },
    "phone": {
      "type": "string"
    },
    "email": {
      "type": "string"
    },
    "employee_id": {
      "type": "string"
    },
    "specializations": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Irrigation system specializations"
    },
    "certifications": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "current_location": {
      "type": "object",
      "properties": {
        "lat": {
          "type": "number"
        },
        "lng": {
          "type": "number"
        },
        "updated_at": {
          "type": "string",
          "format": "date-time"
        }
      }
    },
    "availability_status": {
      "type": "string",
      "enum": [
        "available",
        "on_job",
        "break",
        "offline"
      ],
      "default": "offline"
    },
    "current_job_id": {
      "type": "string"
    },
    "rating": {
      "type": "number",
      "description": "Average rating 1-5"
    },
    "jobs_completed": {
      "type": "number",
      "default": 0
    },
    "avatar_url": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "active",
        "inactive"
      ],
      "default": "active"
    }
  },
  "required": [
    "name",
    "phone",
    "employee_id"
  ]
}