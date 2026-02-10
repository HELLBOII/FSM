{
  "name": "Client",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Client/Farmer name"
    },
    "phone": {
      "type": "string",
      "description": "Contact phone number"
    },
    "email": {
      "type": "string",
      "description": "Email address"
    },
    "farm_name": {
      "type": "string",
      "description": "Name of the farm"
    },
    "address": {
      "type": "string",
      "description": "Farm address"
    },
    "location": {
      "type": "object",
      "description": "GPS coordinates",
      "properties": {
        "lat": {
          "type": "number"
        },
        "lng": {
          "type": "number"
        }
      }
    },
    "total_acreage": {
      "type": "number",
      "description": "Total farm acreage"
    },
    "irrigation_systems": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Types of irrigation systems installed"
    },
    "notes": {
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
    "farm_name"
  ]
}