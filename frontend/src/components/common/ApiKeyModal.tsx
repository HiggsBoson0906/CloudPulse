import React, { useState } from 'react';
import { Key, Eye, EyeOff, X, Check, AlertCircle } from 'lucide-react';
import { api, DEV_DEFAULT_ADMIN_KEY } from '../../api/client';
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

  const currentKey = api.getApiKey();
  const isConfigured = Boolean(currentKey && currentKey.trim().length > 0);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const cleanKey = keyInput.trim();
    api.setApiKey(cleanKey);
    onKeySaved(cleanKey);
    onClose();
  }

  function handleClear() {
    api.setApiKey('');
    setKeyInput('');
    onKeySaved('');
    onClose();
  }

  function handleUseDevKey() {
    setKeyInput(DEV_DEFAULT_ADMIN_KEY);
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <div className={styles.iconWrapper}>
              <Key size={16} />
            </div>
            <h3 className={styles.title}>API Authentication Key</h3>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className={styles.body}>
            {isConfigured ? (
              <div className={`${styles.statusBanner} ${styles.statusConfigured}`}>
                <Check size={14} />
                <span>API Key is active and attached to requests</span>
              </div>
            ) : (
              <div className={`${styles.statusBanner} ${styles.statusMissing}`}>
                <AlertCircle size={14} />
                <span>No API key active — protected API calls will return 401</span>
              </div>
            )}

            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="api-key-input">
                API Key or Bearer Token
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="api-key-input"
                  type={showKey ? 'text' : 'password'}
                  className={styles.input}
                  placeholder="e.g. cp-admin-dev-key-32chars-prod-ready"
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

            <button
              type="button"
              className={styles.quickActionBtn}
              onClick={handleUseDevKey}
              title="Paste standard development admin key"
            >
              <span>Use Default Admin Key</span>
              <span className={styles.codeInline}>cp-admin-dev-key-32chars-prod-ready</span>
            </button>

            <div className={styles.helpText}>
              <strong>Deployment note:</strong> On Vercel, you can also set the{' '}
              <span className={styles.codeInline}>VITE_API_KEY</span> environment variable in your Vercel Project Settings so all clients authenticate automatically.
            </div>
          </div>

          <div className={styles.footer}>
            {isConfigured && (
              <button type="button" className={styles.clearBtn} onClick={handleClear}>
                Clear Key
              </button>
            )}
            <button type="submit" className={styles.saveBtn}>
              <Check size={14} />
              <span>Save & Connect</span>
            </button>
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
