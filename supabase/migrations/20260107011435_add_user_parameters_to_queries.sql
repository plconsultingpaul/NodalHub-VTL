/*
  # Add user_parameters column to queries table

  1. Changes
    - Add `user_parameters` JSONB column to `queries` table
    - Stores runtime parameters that users must provide when executing the query
    - Structure: [{ "name": "@ParamName", "prompt": "Enter value", "dataType": "Text|Date|Integer|Double|Boolean" }]

  2. Purpose
    - Allows queries to have dynamic parameters that are prompted at runtime
    - Data types determine the input control shown to users:
      - Text: Standard text input
      - Integer: Number input (whole numbers)
      - Double: Number input (decimals)
      - Boolean: Checkbox or toggle
      - Date: Date picker
*/

ALTER TABLE queries
ADD COLUMN IF NOT EXISTS user_parameters jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN queries.user_parameters IS 'Runtime parameters that users provide when executing the query. Structure: [{ name, prompt, dataType }]';
