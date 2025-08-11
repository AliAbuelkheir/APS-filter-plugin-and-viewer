# Query JSON Format for Filtering Model Elements

This document describes the JSON structure supported by the backend queryService for filtering model elements.

---

## Query Object Structure

A query is a JSON object with the following structure:

```json
{
  "logic": "AND" | "OR",
  "conditions": [
    { /* condition object */ },
    { /* nested query object */ },
    ...
  ]
}
```

- **logic**: `"AND"` or `"OR"`. Determines how the conditions are combined.
- **conditions**: An array of either property filter conditions or nested query objects.

---

## Condition Object

A condition can be:

### 1. Property Filter

```json
{
  "category": "string",   // Property category (e.g., "Dimensions")
  "field": "string",      // Property field name (e.g., "Height")
  "operator": "contains" | "does_not_contain" | "starts_with" | "equals" | "greater_than" | "less_than" | "greater_than_or_equal" | "less_than_or_equal",
  "value": "string|number" // Value to compare against
}
```

#### Supported Operators

- `"contains"`: Checks if the property value contains the given value (case-insensitive, string match).
- `"does_not_contain"`: Checks if the property value does NOT contain the given value.
- `"starts_with"`: Checks if the property value starts with the given value.
- `"equals"`: Checks for exact match (string or number).
- `"greater_than"`: Numeric comparison.
- `"less_than"`: Numeric comparison.
- `"greater_than_or_equal"`: Numeric comparison.
- `"less_than_or_equal"`: Numeric comparison.

### 2. Nested Query

A nested query is another query object (with its own `logic` and `conditions`) inside the `conditions` array, allowing for complex boolean logic.

---

## Single Condition Shortcut

If you want to filter by a single property, you can send:

```json
{
  "conditions": {
    "category": "Dimensions",
    "field": "Height",
    "operator": "greater_than",
    "value": 2000
  }
}
```
The backend will treat this as an AND query with one condition.

---

## Example Queries

### Simple AND Query

```json
{
  "logic": "AND",
  "conditions": [
    { "category": "Dimensions", "field": "Height", "operator": "greater_than", "value": 2000 },
    { "category": "Constraints", "field": "Level", "operator": "equals", "value": "Level 1" }
  ]
}
```

### Nested Query

```json
{
  "logic": "AND",
  "conditions": [
    { "category": "Category", "field": "Row Status", "operator": "contains", "value": "Active" },
    {
      "logic": "OR",
      "conditions": [
        { "category": "Category", "field": "Row Status", "operator": "starts_with", "value": "A" },
        { "category": "Category", "field": "Row Status", "operator": "equals", "value": "Pending" }
      ]
    }
  ]
}
```

---

## Usage

- The frontend builds this JSON based on user input.
- Send it via POST to `/api/query`.
- The backend will return matching `dbIds` and a count.

---

