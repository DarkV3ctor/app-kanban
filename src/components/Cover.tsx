import { useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { coverFromFile, coverFromLink, coverHost, coverKind } from '../lib/cover';
import { cls } from '../lib/utils';
import { Icon } from './Icons';

/**
 * A cover picture: the whole image (never cropped, whatever its shape) on a blurred copy of
 * itself that fills the frame. Linked pictures are loaded without a referrer. `fallback` is
 * shown instead when the picture cannot be loaded.
 */
export function CoverImage({ src, className, fallback = null }: { src: string; className?: string; fallback?: ReactNode }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return <>{fallback}</>;
  const common = { src, referrerPolicy: 'no-referrer', decoding: 'async', loading: 'lazy', draggable: false } as const;
  return (
    <div className={cls('cover', className)}>
      <img className="cover-backdrop" alt="" aria-hidden="true" {...common} />
      <img className="cover-img" alt="" {...common} onError={() => setFailed(src)} />
    </div>
  );
}

/** The image link in something dropped or pasted: an <img> in HTML first, else a plain link. */
function linkIn(data: DataTransfer): string | null {
  const html = data.getData('text/html');
  if (html) {
    // A parsed document runs no scripts and loads nothing.
    const src = new DOMParser().parseFromString(html, 'text/html').querySelector('img')?.getAttribute('src');
    const cover = src ? coverFromLink(src) : null;
    if (cover) return cover;
  }
  const uri = data
    .getData('text/uri-list')
    .split(/\r?\n/)
    .find((l) => l && !l.startsWith('#'));
  return coverFromLink(uri || data.getData('text/plain'));
}

/**
 * Shows an issue's cover and lets editors set it: upload a file, drop or paste an image (or an
 * image from another page), or give a link. `onChange` receives the new cover ('' removes it).
 */
export function CoverEditor({ value, onChange, disabled }: { value: string; onChange: (cover: string) => unknown; disabled?: boolean }) {
  const [linking, setLinking] = useState(false);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const kind = coverKind(value);

  if (disabled && !value) return null;

  const upload = async (file: Blob) => {
    setError('');
    setBusy(true);
    try {
      const cover = await coverFromFile(file);
      setLinking(false);
      await onChange(cover);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const applyLink = (text: string) => {
    const cover = coverFromLink(text);
    if (!cover) {
      setError(t('Paste an https:// link to an image.'));
      return;
    }
    setError('');
    setLinking(false);
    setLink('');
    onChange(cover);
  };

  /** A dropped or pasted image file is uploaded; a dropped or pasted image link is used as is. */
  const take = (data: DataTransfer): boolean => {
    const file = [...data.files].find((f) => f.type.startsWith('image/'));
    if (file) {
      upload(file);
      return true;
    }
    const cover = linkIn(data);
    if (cover) {
      applyLink(cover);
      return true;
    }
    return false;
  };

  const zone = disabled
    ? {}
    : {
        tabIndex: 0,
        role: 'group',
        'aria-label': t('Cover: drop or paste an image here'),
        onPaste: (e: React.ClipboardEvent) => take(e.clipboardData) && e.preventDefault(),
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setOver(true);
        },
        onDragLeave: () => setOver(false),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setOver(false);
          if (!take(e.dataTransfer)) setError(t('Drop an image file or an image from another page.'));
        },
      };

  return (
    <div className="cover-editor">
      <div className={cls('cover-zone', over && 'is-over', busy && 'is-busy')} {...zone}>
        {value ? (
          <CoverImage
            key={value}
            src={value}
            className="cover-large"
            fallback={
              <div className="cover-empty">
                <Icon name="image" size={22} />
                <span>{t('The image could not be loaded')}</span>
                {kind === 'link' && <span className="muted small">{coverHost(value)}</span>}
              </div>
            }
          />
        ) : (
          <div className="cover-empty">
            <Icon name="image" size={22} />
            <span>{busy ? t('Preparing the image…') : t('Drop or paste an image here')}</span>
          </div>
        )}
      </div>
      {!disabled &&
        (linking ? (
          <div className="cover-link-row">
            <input
              className="input input-compact"
              autoFocus
              type="url"
              value={link}
              placeholder="https://…"
              aria-label={t('Image link')}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyLink(link);
                }
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setLinking(false);
                  setError('');
                }
              }}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={() => applyLink(link)} disabled={!link.trim()}>
              {t('Save')}
            </button>
            <button
              type="button"
              className="btn btn-subtle btn-sm"
              onClick={() => {
                setLinking(false);
                setError('');
              }}
            >
              {t('Cancel')}
            </button>
          </div>
        ) : (
          <div className="cover-actions">
            <button type="button" className="btn btn-subtle btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Icon name="upload" size={14} /> {value ? t('Replace') : t('Upload')}
            </button>
            <button
              type="button"
              className="btn btn-subtle btn-sm"
              onClick={() => {
                setLink(kind === 'link' ? value : '');
                setLinking(true);
              }}
              disabled={busy}
            >
              <Icon name="link" size={14} /> {t('By link')}
            </button>
            {value && (
              <button type="button" className="btn btn-subtle btn-sm" onClick={() => onChange('')} disabled={busy}>
                <Icon name="trash" size={14} /> {t('Remove')}
              </button>
            )}
          </div>
        ))}
      {error && (
        <div className="cover-error small" role="alert">
          {error}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) upload(file);
        }}
      />
    </div>
  );
}
