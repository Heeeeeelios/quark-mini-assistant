import type { ReactElement } from 'react';
import { useState, useRef, useEffect } from 'react';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => Promise<boolean>;
  hasExistingKey: boolean;
}

export default function SettingsModal({
  isOpen,
  onClose,
  onSave,
  hasExistingKey,
}: SettingsModalProps): ReactElement {
  const [key, setKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setKey('');
      setSaveError(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  const handleSave = async () => {
    const trimmed = key.trim();
    if (!trimmed) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const success = await onSave(trimmed);
      if (success) {
        setSaveSuccess(true);
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setSaveError('保存失败，请重试');
      }
    } catch {
      setSaveError('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return <></>;

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <header className="settings-modal__header">
          <h2 className="settings-modal__title">⚙️ API Key 设置</h2>
          <button className="settings-modal__close" onClick={onClose}>✕</button>
        </header>

        <div className="settings-modal__body">
          <p className="settings-modal__description">
            请输入 DashScope API Key 以启用 AI 功能。
            <br />
            <span className="settings-modal__hint">
              获取地址：
              <a
                href="https://bailian.console.aliyun.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                阿里云百炼控制台
              </a>
            </span>
          </p>

          <textarea
            ref={inputRef}
            className="settings-modal__input"
            placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            spellCheck={false}
          />

          {saveError && (
            <p className="settings-modal__error">{saveError}</p>
          )}
          {saveSuccess && (
            <p className="settings-modal__success">✅ 保存成功，AI 功能已启用！</p>
          )}

          <div className="settings-modal__footer">
            {hasExistingKey && (
              <span className="settings-modal__existing">
                已配置 Key（保存新 Key 将覆盖）
              </span>
            )}
            <div className="settings-modal__actions">
              <button
                className="settings-modal__btn settings-modal__btn--cancel"
                onClick={onClose}
                disabled={isSaving}
              >
                取消
              </button>
              <button
                className="settings-modal__btn settings-modal__btn--save"
                onClick={handleSave}
                disabled={!key.trim() || isSaving}
              >
                {isSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
