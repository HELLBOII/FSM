{
  "name": "Equipment",
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "category": {
      "type": "string",
      "enum": [
        "pipes",
        "valves",
        "fittings",
        "filters",
        "pumps",
        "controllers",
        "sensors",
        "tools",
        "chemicals",
        "other"
      ]
    },
    "sku": {
      "type": "string"
    },
    "unit": {
      "type": "string",
      "description": "Unit of measurement (pcs, meters, liters, etc.)"
    },
    "stock_quantity": {
      "type": "number"
    },
    "min_stock_level": {
      "type": "number"
    },
    "unit_cost": {
      "type": "number"
    },
    "description": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "in_stock",
        "low_stock",
        "out_of_stock"
      ],
      "default": "in_stock"
    }
  },
  "required": [
    "name",
    "category",
    "unit"
  ]
}