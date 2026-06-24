import {useRef, useState, type DragEvent} from 'react';
import {Button} from '@/components/ui/button';
import {uploadWebampSkin} from './webamp-skin-repository';

type UploadLog = {
  id: string;
  message: string;
};

export function WebampSkinUploaderPage() {
  const inputReference = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [logs, setLogs] = useState<UploadLog[]>([]);

  const addLog = (message: string) => {
    setLogs((currentLogs) => [
      {id: crypto.randomUUID(), message},
      ...currentLogs,
    ]);
  };

  const uploadFiles = async (fileList: FileList | File[]) => {
    const files = [...fileList].filter((file) =>
      file.name.toLowerCase().endsWith('.wsz'),
    );

    if (files.length === 0 || busy) {
      return;
    }

    setBusy(true);

    try {
      for (const file of files) {
        addLog(`Uploading ${file.name}`);
        const id = await uploadWebampSkin({
          file,
          onProgress(progress) {
            addLog(`${file.name}: ${progress}%`);
          },
        });
        addLog(`Saved webampSkins/${id}`);
      }
    } catch (error) {
      addLog(error instanceof Error ? error.message : 'Unknown upload error');
    } finally {
      setBusy(false);
      if (inputReference.current) {
        inputReference.current.value = '';
      }
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void uploadFiles(event.dataTransfer.files);
  };

  return (
    <main className="min-h-screen bg-black px-6 py-8 font-mono text-white">
      <section className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">webamp-skin-uploader</h1>
          <a className="text-sm underline underline-offset-4" href="/">
            home
          </a>
        </header>

        <div
          className={[
            'flex min-h-[22rem] flex-col items-center justify-center gap-5 border-2 border-dashed p-8 text-center transition-colors',
            dragging
              ? 'border-white bg-white text-black'
              : 'border-white/70 bg-white/5 text-white',
          ].join(' ')}
          onDragLeave={() => {
            setDragging(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDrop={handleDrop}
        >
          <input
            ref={inputReference}
            multiple
            accept=".wsz"
            className="hidden"
            type="file"
            onChange={(event) => {
              if (event.target.files) {
                void uploadFiles(event.target.files);
              }
            }}
          />
          <p className="text-lg">Drop .wsz files here</p>
          <Button
            className="border border-white bg-white text-black"
            disabled={busy}
            onClick={() => inputReference.current?.click()}
          >
            {busy ? 'Uploading...' : 'Choose skins'}
          </Button>
        </div>

        {logs.length > 0 && (
          <pre className="max-h-80 overflow-auto border border-white/30 bg-white/5 p-4 text-xs leading-relaxed text-white/80">
            {logs.map((log) => log.message).join('\n')}
          </pre>
        )}
      </section>
    </main>
  );
}
