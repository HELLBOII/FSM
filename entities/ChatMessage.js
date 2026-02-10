{
  "name": "ChatMessage",
  "type": "object",
  "properties": {
    "conversation_id": {
      "type": "string",
      "description": "Unique ID for conversation thread"
    },
    "service_request_id": {
      "type": "string",
      "description": "Related service request"
    },
    "request_number": {
      "type": "string",
      "description": "SR number for reference"
    },
    "sender_user_id": {
      "type": "string",
      "description": "User ID of sender"
    },
    "sender_name": {
      "type": "string",
      "description": "Display name of sender"
    },
    "sender_role": {
      "type": "string",
      "enum": [
        "admin",
        "supervisor",
        "technician",
        "client"
      ],
      "description": "Role of sender"
    },
    "message": {
      "type": "string",
      "description": "Message content"
    },
    "message_type": {
      "type": "string",
      "enum": [
        "text",
        "system"
      ],
      "default": "text"
    },
    "attachments": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Attachment URLs"
    },
    "read_by": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "User IDs who read the message",
      "default": []
    }
  },
  "required": [
    "conversation_id",
    "sender_name",
    "message"
  ]
}