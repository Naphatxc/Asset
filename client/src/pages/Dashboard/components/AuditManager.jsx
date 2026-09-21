// ตรวจนับครุภัณฑ์ประจำปี (เฉพาะ Admin) — เปิด/ปิดรอบ ดูความคืบหน้า และดูสรุปผลย้อนหลัง
// การเดินสแกนจริงอยู่ที่หน้า /audit/:roundId (AuditScanPage) ซึ่งออกแบบมาให้ใช้บนมือถือเต็มจอ
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { closeAuditRound, getAuditRounds, openAuditRound } from '../../../api/audit.js';
import { useToast } from '../../../components/ToastProvider.jsx';
import { defaultRoundTitle, formatDateTime } from '../../../utils/audit.js';
import AuditSummary from './AuditSummary.jsx';

const MAX_TITLE_LENGTH = 100;

export default function AuditManager() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [summaryRoundId, setSummaryRoundId] = useState(null);

  const roundsQuery = useQuery({ queryKey: ['audit-rounds'], queryFn: getAuditRounds });
  const rounds = roundsQuery.data?.rounds ?? [];
  const openRound = rounds.find((round) => round.status === 'open') ?? null;
  const pastRounds = rounds.filter((round) => round.status === 'closed');

  function invalidateRounds(roundId) {
    queryClient.invalidateQueries({ queryKey: ['audit-rounds'] });
    queryClient.invalidateQueries({ queryKey: ['audit', roundId] });
  }

  const openMutation = useMutation({
    mutationFn: () => openAuditRound(title),
    onSuccess: (data) => {
      invalidateRounds(data.round.round_id);
      setFormOpen(false);
      showSuccess(`เปิดรอบแล้ว มีครุภัณฑ์ต้องตรวจ ${data.records.length} ชิ้น`);
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  const closeMutation = useMutation({
    mutationFn: () => closeAuditRound(openRound.round_id),
    onSuccess: (data) => {
      invalidateRounds(data.round.round_id);
      setConfirmingClose(false);
      setSummaryRoundId(data.round.round_id);
      showSuccess('ปิดรอบตรวจนับแล้ว');
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  function startForm() {
    setTitle(defaultRoundTitle());
    setFormOpen(true);
  }

  function submitForm(event) {
    event.preventDefault();
    openMutation.mutate();
  }

  function toggleSummary(roundId) {
    setSummaryRoundId((current) => (current === roundId ? null : roundId));
  }

  const counts = openRound?.counts;
  const openPercent =
    counts && counts.total > 0
      ? Math.round(((counts.normal + counts.damaged) / counts.total) * 100)
      : 0;

  return (
    <section className="equipment-section">
      <div className="section-heading equipment-toolbar">
        <div>
          <p className="section-kicker">Annual audit</p>
          <h2>ตรวจนับครุภัณฑ์ประจำปี</h2>
        </div>

        <div className="toolbar-actions">
          {!openRound && !formOpen && !roundsQuery.isLoading && (
            <button className="button-primary" type="button" onClick={startForm}>
              + เปิดรอบตรวจนับใหม่
            </button>
          )}
        </div>
      </div>

      {roundsQuery.error && <p className="error-message">{roundsQuery.error.message}</p>}

      {formOpen && (
        <form className="equipment-form" onSubmit={submitForm}>
          <div className="form-heading">
            <div>
              <p className="section-kicker">New round</p>
              <h3>เปิดรอบตรวจนับใหม่</h3>
            </div>
          </div>

          <div className="form-grid">
            <label className="field-wide">
              ชื่อรอบ
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={MAX_TITLE_LENGTH}
                required
              />
            </label>
          </div>
          <p className="user-note">
            ระบบจะใช้ครุภัณฑ์ทุกชิ้นที่มีอยู่ตอนนี้เป็นรายการที่ต้องตรวจ โดยจำห้องของแต่ละชิ้น ณ ตอนเปิดรอบไว้
            เปิดได้ครั้งละหนึ่งรอบเท่านั้น
          </p>

          <div className="form-actions">
            <button className="button-primary" type="submit" disabled={openMutation.isPending}>
              {openMutation.isPending ? 'กำลังเปิดรอบ...' : 'เปิดรอบ'}
            </button>
            <button className="button-secondary" type="button" onClick={() => setFormOpen(false)}>
              ยกเลิก
            </button>
          </div>
        </form>
      )}

      {roundsQuery.isLoading ? (
        <p className="loading-message">กำลังโหลดรอบตรวจนับ...</p>
      ) : openRound ? (
        <div className="audit-open-round">
          <div>
            <p className="section-kicker">กำลังตรวจ</p>
            <h3>{openRound.title}</h3>
            <p className="audit-round-meta">
              เปิดโดย {openRound.opened_by_name} · {formatDateTime(openRound.opened_at)}
            </p>
          </div>

          <div className="audit-progress">
            <div className="audit-progress-track">
              <div className="audit-progress-fill" style={{ width: `${openPercent}%` }} />
            </div>
            <span>
              {counts.normal + counts.damaged}/{counts.total} ({openPercent}%)
            </span>
          </div>

          <p className="audit-round-meta">
            ปกติ {counts.normal} · ชำรุด {counts.damaged} · ยังไม่ตรวจ {counts.unchecked}
          </p>

          <div className="row-actions">
            <Link className="button-link button-primary" to={`/audit/${openRound.round_id}`}>
              เริ่มเดินสแกน
            </Link>
            <button type="button" onClick={() => toggleSummary(openRound.round_id)}>
              {summaryRoundId === openRound.round_id ? 'ซ่อนรายการ' : 'ดูรายการ'}
            </button>
            {!confirmingClose && (
              <button
                type="button"
                className="button-danger"
                onClick={() => setConfirmingClose(true)}
              >
                ปิดรอบ
              </button>
            )}
          </div>

          {confirmingClose && (
            <div className="audit-confirm">
              <p>
                {counts.unchecked > 0
                  ? `ยังไม่ได้ตรวจอีก ${counts.unchecked} ชิ้น ถ้าปิดรอบตอนนี้จะนับเป็น "ไม่พบ" (ยกเว้นชิ้นที่ถูกยืมหรืออยู่ระหว่างซ่อม) และแก้ผลไม่ได้อีก`
                  : 'ตรวจครบทุกชิ้นแล้ว ปิดรอบแล้วจะแก้ผลไม่ได้อีก'}
              </p>
              <div className="row-actions">
                <button
                  type="button"
                  className="button-danger"
                  disabled={closeMutation.isPending}
                  onClick={() => closeMutation.mutate()}
                >
                  {closeMutation.isPending ? 'กำลังปิดรอบ...' : 'ยืนยันปิดรอบ'}
                </button>
                <button type="button" onClick={() => setConfirmingClose(false)}>
                  ยกเลิก
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        !formOpen && (
          <div className="empty-state">
            <p>ยังไม่มีรอบที่กำลังตรวจ กด "เปิดรอบตรวจนับใหม่" เพื่อเริ่ม</p>
          </div>
        )
      )}

      {openRound && summaryRoundId === openRound.round_id && (
        <AuditSummary roundId={openRound.round_id} />
      )}

      {pastRounds.length > 0 && (
        <>
          <h3 className="audit-history-heading">รอบที่ผ่านมา</h3>
          <div className="table-wrap">
            <table className="equipment-table responsive-table">
              <thead>
                <tr>
                  <th>รอบ</th>
                  <th>ช่วงเวลา</th>
                  <th>ผล</th>
                  <th>การกระทำ</th>
                </tr>
              </thead>
              <tbody>
                {pastRounds.map((round) => (
                  <tr key={round.round_id}>
                    <td data-label="รอบ">{round.title}</td>
                    <td data-label="ช่วงเวลา">
                      {formatDateTime(round.opened_at)}
                      <br />
                      <small>ถึง {formatDateTime(round.closed_at)}</small>
                    </td>
                    <td data-label="ผล">
                      ปกติ {round.counts.normal} · ชำรุด {round.counts.damaged} · ไม่พบ{' '}
                      {round.counts.missing}
                    </td>
                    <td className="stack-actions">
                      <div className="row-actions">
                        <button type="button" onClick={() => toggleSummary(round.round_id)}>
                          {summaryRoundId === round.round_id ? 'ซ่อนผล' : 'ดูผล'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {summaryRoundId && summaryRoundId !== openRound?.round_id && (
        <AuditSummary roundId={summaryRoundId} />
      )}
    </section>
  );
}
