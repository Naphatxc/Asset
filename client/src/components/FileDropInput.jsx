// ช่องแนบไฟล์ที่ลากไฟล์มาวางได้ (drag & drop) หรือคลิกเพื่อเลือกไฟล์แบบเดิม — ใช้ร่วมกันทั้งฟอร์มแจ้งซ่อมใหม่
// (RepairManager.jsx) และแนบไฟล์เพิ่มระหว่างซ่อม (RepairDetailDialog.jsx) ไฟล์ที่เลือกไว้ยังลบออกทีละไฟล์ได้
import { useRef, useState } from 'react';

export default function FileDropInput({
  files,
  onChange,
  multiple = true,
  accept,
  label = 'ลากไฟล์มาวางตรงนี้ หรือคลิกเพื่อเลือกไฟล์',
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(fileList) {
    const incoming = Array.from(fileList ?? []);
    if (incoming.length === 0) return;

    onChange(multiple ? [...files, ...incoming] : incoming.slice(0, 1));
  }

  function removeFile(index) {
    onChange(files.filter((_, fileIndex) => fileIndex !== index));
  }

  return (
    <div className="file-drop">
      <div
        className={`file-drop-zone${dragOver ? ' file-drop-zone-active' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <p>{label}</p>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          className="file-drop-native-input"
          onChange={(event) => {
            addFiles(event.target.files);
            // เคลียร์ value กัน onChange ไม่ยิงซ้ำถ้าเลือกไฟล์เดิมอีกรอบ
            event.target.value = '';
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="file-list">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${index}`}>
              <span className="file-chip file-chip-removable">
                {file.name}
                <button
                  type="button"
                  aria-label={`นำไฟล์ ${file.name} ออก`}
                  onClick={() => removeFile(index)}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
