import React from 'react';
import { Field, Input, Select } from './ui/Field';

const InputField = React.memo(({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  disabled = false,
  fieldName = null,
  options = []
}) => {
  const handleChange = (e) => {
    const val = e.target.value;
    if (fieldName) {
      onChange(fieldName, val);
    } else {
      onChange(val);
    }
  };

  return (
    <Field label={label}>
      {type === "select" ? (
        <Select name={fieldName ?? undefined} value={value} onChange={handleChange} disabled={disabled}>
          <option value="">Seleccionar...</option>
          {options.map((opt, i) => {
            const val = typeof opt === 'string' ? opt : opt.value;
            const text = typeof opt === 'string' ? opt.replace(/_/g, ' ') : opt.label;
            return <option key={i} value={val}>{text}</option>;
          })}
        </Select>
      ) : (
        <Input
          name={fieldName ?? undefined}
          type={type}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          inputMode={type === 'number' ? 'decimal' : undefined}
        />
      )}
    </Field>
  );
});

export default InputField;
