// ปุ่มกรองด่วนเหนือตาราง แสดงจำนวนในแต่ละกลุ่ม กดแล้วกรองทันที (อยากยกเลิกให้กดปุ่ม "ทั้งหมด")
// options: [{ value, label, count, tone? }] value '' = ทั้งหมด tone = ชื่อสถานะไว้ใส่สี (pending/approved/returned)
// ตัวเลขใน chip นับจากรายการทั้งหมด ไม่เปลี่ยนตามตัวกรองอื่น จะได้เห็นภาพรวมเสมอ
export default function StatusChips({ options, value, onChange, ariaLabel }) {
  return (
    <div className="status-chips" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        const classes = ['status-chip', option.tone ? `tone-${option.tone}` : '', active ? 'active' : '']
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={option.value || 'all'}
            className={classes}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            <span className="status-chip-count">{option.count}</span>
            <span className="status-chip-label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
