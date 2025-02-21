import type {
  FormEvent,
} from 'react';
import type { FC, RefObject, TeactNode } from '../../../../lib/teact/teact';
import React, {
  memo,
  useCallback, useEffect,
  useRef, useState,
} from '../../../../lib/teact/teact';

import type { ApiChatFolder } from '../../../../api/types';
import type { MergedApiFolder } from '../../../../util/ApiFolderSplitAndMerge';
import type { TFolderIcon } from './FolderIconPickerMenu';

import { mergeApiFolder, splitApiFolder } from '../../../../util/ApiFolderSplitAndMerge';
import buildClassName from '../../../../util/buildClassName';
import { getFolderIconName } from '../../../../util/folderIcons';

import useFlag from '../../../../hooks/useFlag';
import useOldLang from '../../../../hooks/useOldLang';

import CustomEmoji from '../../../common/CustomEmoji';
import Icon from '../../../common/icons/Icon';
import AnimatedEmoji from '../../../middle/message/AnimatedEmoji';
import FolderIconPickerMenu from './FolderIconPickerMenu';

import './FolderInput.scss';

const ICON_SIZE = 30;

type OwnProps = {
  ref?: RefObject<HTMLInputElement>;
  id?: string;
  className?: string;
  folder?: Omit<ApiChatFolder, 'id' | 'description'>;
  label?: string;
  error?: string;
  success?: string;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  tabIndex?: number;
  teactExperimentControlled?: boolean;
  inputMode?: 'text' | 'none' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  onChange: (e: MergedApiFolder) => void;
  onInput?: (e: FormEvent<HTMLInputElement>) => void;
  onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  leftButton?: TeactNode;
};

const FolderInput: FC<OwnProps> = ({
  ref,
  id,
  className,
  folder,
  label,
  error,
  success,
  disabled,
  readOnly,
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
  tabIndex,
  teactExperimentControlled,
  onChange,
  onKeyPress,
  onKeyDown,
  onBlur,
  onPaste,
}) => {
  const lang = useOldLang();
  const labelText = error || success || label;
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, open, close] = useFlag(false);

  const [value, setValue] = useState('');
  // eslint-disable-next-line no-null/no-null
  const [icon, setIcon] = useState<TFolderIcon | null>(null);
  const fullClassName = buildClassName(
    'input-group',
    value && 'touched',
    error ? 'error' : success && 'success',
    disabled && 'disabled',
    readOnly && 'disabled',
    labelText && 'with-label',
    className,
  );

  useEffect(() => {
    if (!folder) return;
    const splttedApiFolder = splitApiFolder(folder.title, folder.emoticon);
    setValue(splttedApiFolder.title.text);
    setIcon(splttedApiFolder.icon);
  }, []);

  const renderIcon = (iconContent: TFolderIcon | null) => {
    if (!iconContent) {
      return <Icon name="folder-1" />;
    }

    switch (iconContent.type) {
      case 'icon': {
        return <Icon name={getFolderIconName(iconContent.emoticon)} />;
      }
      case 'customEmoji': {
        return (
          <CustomEmoji
            key={iconContent.documentId}
            documentId={iconContent.documentId}
            style={`width: ${ICON_SIZE}px; height: ${ICON_SIZE}px;`}
            size={ICON_SIZE}
            isBig
          />
        );
      }
      case 'emoji': {
        return (
          <AnimatedEmoji
            emoji={iconContent.emoticon}
            forceLoadPreview
            withEffects
            customSize={ICON_SIZE}
          />
        );
      }
    }
    return <Icon name="folder-1" />;
  };

  useEffect(() => {
    if (!onChange) return;
    onChange(mergeApiFolder({ title: { text: value, entities: [] }, icon }));
  }, [onChange, value, icon]);

  const handleIconSelect = useCallback((newIcon: TFolderIcon) => {
    setIcon(newIcon);
  }, [setIcon]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { currentTarget } = event;
    setValue(currentTarget.value.trim());
  }, [setValue]);

  return (
    <>
      <div
        className={fullClassName}
        dir={lang.isRtl ? 'rtl' : undefined}
        ref={containerRef}
      >
        <div
          className="form-control folder-input-from-control"
        >
          <input
            ref={ref}
            type="text"
            id={id}
            dir="auto"
            value={value || ''}
            tabIndex={tabIndex}
            placeholder={placeholder}
            maxLength={maxLength}
            autoComplete={autoComplete}
            inputMode={inputMode}
            disabled={disabled}
            readOnly={readOnly}
            onInput={handleInputChange}
            onKeyPress={onKeyPress}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            onPaste={onPaste}
            aria-label={labelText}
            teactExperimentControlled={teactExperimentControlled}
            className="folder-input"
          />
          <button
            className="folder-input-icon-button"
            onClick={open}
          >
            {renderIcon(icon)}
          </button>
        </div>
        {labelText && (
          <label htmlFor={id} className="folder-input-label">{labelText}</label>
        )}
      </div>
      <FolderIconPickerMenu
        isOpen={isOpen}
        containerRef={containerRef}
        onClose={close}
        onIconSelect={handleIconSelect}
      />
    </>
  );
};

export default memo(FolderInput);
