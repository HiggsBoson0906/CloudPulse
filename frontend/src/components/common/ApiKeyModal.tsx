import React, { useState } from 'react';
import { Key, Eye, EyeOff, X, Check } from 'lucide-react';
import { api } from '../../api/client';
import styles from './ApiKeyModal.module.css';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved: (newKey: string) => void;
}

const ApiKeyModalContent: React.FC<{
  onClose: () => void;
  onKeySaved: (newKey: string) => void;
}> = ({ onClose, onKeySaved }) => {
  const [keyInput, setKeyInput] = useState(() => api.getApiKey() || '');
  const [showKey, setShowKey] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(() => {
    return typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('cloudpulse_api_key'));
  });

  const currentKey = api.getApiKey();
  const isConfigured = Boolean(currentKey && currentKey.trim().length > 0);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const cleanKey = keyInput.trim();
    api.setApiKey(cleanKey, rememberDevice);
    onKeySaved(cleanKey);
    onClose();
  }

  function handleClear() {
    api.setApiKey('', false);
    setKeyInput('');
    onKeySaved('');
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <div className={styles.iconWrapper}>
              <Key size={15} />
            </div>
            <h3 className={styles.title}>API Authentication</h3>
            <span
              className={
                isConfigured ? styles.statusBadgeConfigured : styles.statusBadgeMissing
              }
            >
              {isConfigured ? 'Active' : 'Unset'}
            </span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className={styles.body}>
            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="api-key-input">
                API Key / Bearer Token
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="api-key-input"
                  type={showKey ? 'text' : 'password'}
                  className={styles.input}
                  placeholder="Paste your API key or Bearer token"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className={styles.toggleVisibilityBtn}
                  onClick={() => setShowKey(!showKey)}
                  title={showKey ? 'Hide key' : 'Show key'}
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <label className={styles.checkboxGroup}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
              />
              <span>Remember on this browser</span>
            </label>
          </div>

          <div className={styles.footer}>
            {isConfigured ? (
              <button type="button" className={styles.clearBtn} onClick={handleClear}>
                Clear Key
              </button>
            ) : (
              <div />
            )}
            <div className={styles.actionGroup}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={styles.saveBtn}>
                <Check size={14} />
                <span>Save Key</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onKeySaved,
}) => {
  if (!isOpen) return null;
  return <ApiKeyModalContent onClose={onClose} onKeySaved={onKeySaved} />;
};
