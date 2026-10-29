import React from 'react';
import { Save } from 'lucide-react';
import InputField from './InputField';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Alert from './ui/Alert';

const ModalForm = React.memo(({
  abierto,
  titulo,
  formData,
  onFormChange,
  onGuardar,
  onCancelar,
  campos,
  loading = false,
  error = null,
  success = null
}) => {
  if (!abierto || !campos) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!loading) onGuardar();
  };

  return (
    <Modal
      onClose={onCancelar}
      title={titulo}
      size={campos.length > 5 ? 'lg' : 'md'}
      footer={(
        <>
          <Button onClick={onCancelar} disabled={loading}>Cancelar</Button>
          <Button type="submit" form="modal-form" variant="primary" icon={Save} loading={loading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </>
      )}
    >
      <form id="modal-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        <div className={campos.length > 5 ? 'grid gap-4 sm:grid-cols-2' : 'space-y-4'}>
          {campos.map(campo => (
            <InputField
              key={campo.name}
              fieldName={campo.name}
              label={campo.label}
              value={formData[campo.name] || ''}
              onChange={onFormChange}
              type={campo.type}
              placeholder={campo.placeholder}
              disabled={loading}
              options={campo.options || []}
            />
          ))}
        </div>
      </form>
    </Modal>
  );
});

export default ModalForm;
