import React from 'react';
import './InlineChatConfirmation.css';

function InlineChatConfirmation({ confirmationData, onConfirm, onCancel }) {
  if (!confirmationData) return null;

  const { confirmation_id, type } = confirmationData;

  return (
    <div className="inline-confirmation">
      <div className="confirmation-actions">
        <button 
          className="confirm-btn-inline"
          onClick={() => onConfirm(confirmation_id)}
        >
          ✅ Confirm
        </button>
        <button 
          className="cancel-btn-inline"
          onClick={() => onCancel(confirmation_id)}
        >
          ❌ Cancel
        </button>
      </div>
    </div>
  );
}

export default InlineChatConfirmation;